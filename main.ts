import { isIP } from 'node:net';
import { parse } from "jsr:@std/csv";

async function handler(_req: Request): Promise<Response> {
  const urlParse = new URL(_req.url);
  const remoteUrlParam = urlParse.searchParams.get("url");
  const listName = urlParse.searchParams.get("name") || "geo-ip-list";
  const autoClean = urlParse.searchParams.has("clean");
  const asnParam = urlParse.searchParams.get("asn");
  const asnList = asnParam ? asnParam.split(',') : [];
  const v4Only = urlParse.searchParams.has("v4");
  const v6Only = urlParse.searchParams.has("v6");
  
  const logCommands: string[] = [];

  if (!remoteUrlParam) {
    logCommands.push(':log info "Missing required parameter: url"');
    return new Response(logCommands.join('\n'), {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  const remoteUrls = remoteUrlParam.split(',').map(url => url.trim());

  try {
    let script = "";
    let validCount = 0;
    let invalidCount = 0;

    if (autoClean) {
      script += `:log info "Clearing address list: ${listName}"\n`;

      if(v4Only) {
        script += `do { /ip firewall address-list remove [find list="${listName}"] } on-error={}\n`;
      } else if(v6Only) {
        script += `do { /ipv6 firewall address-list remove [find list="${listName}"] } on-error={}\n\n`;
      } else {
        script += `do { /ip firewall address-list remove [find list="${listName}"] } on-error={}\n`;
        script += `do { /ipv6 firewall address-list remove [find list="${listName}"] } on-error={}\n\n`;
      }
    }

    const entries: string[] = [];

    // 处理带 ASN 过滤的 CSV 模式
    if (asnList.length > 0) {
      for (const url of remoteUrls) {
        const res = await fetch(url);
        if (!res.ok) {
          logCommands.push(`:log info "HTTP Error: ${res.status} ${res.statusText} (${url})"`);
          return new Response(logCommands.join('\n'), {
            status: 502,
            headers: { "Content-Type": "text/plain" }
          });
        }

        try {
          const csvData = await res.text();
          const records = parse(csvData, {
            skipFirstRow: true,
            strip: true,
          }) as Array<Record<string, string>>;

          for (const record of records) {
            const network = record.network?.trim();
            const asn = record.autonomous_system_number?.trim();

            if (!network || !asn) {
              invalidCount++;
              script += `:log warning "Invalid CSV format in ${url}: ${JSON.stringify(record)}"\n`;
              continue;
            }

            if (asnList.includes(asn)) {
              entries.push(network);
            }
          }
        } catch (error) {
          logCommands.push(`:log error "CSV parse error in ${url}: ${error instanceof Error ? error.message : String(error)}"`);
          return new Response(
            logCommands.join('\n'),
            { status: 500, headers: { "Content-Type": "text/plain" } }
          );
        }
      }
    }
    // 处理普通 IP 列表模式
    else {
      for (const url of remoteUrls) {
        const res = await fetch(url);
        if (!res.ok) {
          logCommands.push(`:log info "HTTP Error: ${res.status} ${res.statusText} (${url})"`);
          return new Response(logCommands.join('\n'), {
            status: 502,
            headers: { "Content-Type": "text/plain" }
          });
        }

        const text = await res.text();
        text.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            entries.push(trimmed);
          }
        });
      }
    }

    // 处理所有条目
    for (const entry of entries) {
      const [ipPart, cidr] = entry.split('/');
      const ipVersion = isIP(ipPart);

      if (ipVersion === 0) {
        invalidCount++;
        script += `:log warning "Invalid IP format: ${entry}"\n`;
        continue;
      }

      if (cidr) {
        const maxCidr = ipVersion === 4 ? 32 : 128;
        const cidrNum = Number(cidr);
        if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > maxCidr) {
          invalidCount++;
          script += `:log warning "Invalid CIDR value: ${entry}"\n`;
          continue;
        }
      }

      if((v4Only && ipVersion === 4) || (v6Only && ipVersion === 6) || (!v4Only && !v6Only)) {
        const cmdType = ipVersion === 4 ? "ip" : "ipv6";
        script += `/${cmdType} firewall address-list add address=${entry} list="${listName}"\n`;
        validCount++;
      }
    }

    script += `\n:log info "Process completed: ${validCount} valid, ${invalidCount} invalid entries"`;

    return new Response(script, {
      headers: { "Content-Type": "text/plain" }
    });

  } catch (error) {
    logCommands.push(
      `:log error "Critical error: ${error instanceof Error ? error.message : String(error)}"`,
      `:log info "Service Info: ${Deno.version.deno} | ${new Date().toISOString()}"`
    );
    return new Response(
      logCommands.join('\n'),
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}

Deno.serve(handler);
