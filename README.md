# RouterOS Address List Updater

基于 Deno 的脚本服务，用于自动生成 RouterOS 防火墙地址列表命令，支持多数据源合并和 ASN 过滤。  
**在线服务地址**：<https://convert-ip-to-rsc.deno.dev/>

## 核心功能
🔄 多数据源合并 | 🔎 ASN 过滤 | 🧼 自动清理 | 📋 CIDR 验证 | 📈 执行统计

## RouterOS 脚本
```ros
:local listName "geo-ip-cn"
:local remoteUrl "https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/cn.txt"
:local serviceUrl "https://convert-ip-to-rsc.deno.dev/?url=$remoteUrl&name=$listName&v4&clean"
:local tmpFile "$listName.rsc"

:log info "Starting GeoIP sync for list: $listName"
do { /file remove $tmpFile } on-error={}
/tool fetch url=$serviceUrl mode=https dst-path=$tmpFile
:delay 1s

:if ([/file find name=$tmpFile] = "") do={
    :log error "Download failed: Unable to fetch file"
} else={
    :log info "Importing $tmpFile"
    do { /import file-name=$tmpFile } on-error={ :log error "Import failed: Unable to import file" }
    do { /file remove $tmpFile } on-error={}
    :log info "Sync completed for $listName"
}
```

## 多数据源以`,`分割
```
:local listName "geo-ip-tunnel"
:local remoteUrl "https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/facebook.txt,https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/google.txt,https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/netflix.txt,https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/telegram.txt,https://raw.githubusercontent.com/Loyalsoldier/geoip/release/text/twitter.txt,https://raw.githubusercontent.com/ipverse/asn-ip/refs/heads/master/as/36459/ipv4-aggregated.txt,https://raw.githubusercontent.com/ipverse/asn-ip/refs/heads/master/as/138997/ipv4-aggregated.txt,https://raw.githubusercontent.com/ipverse/asn-ip/refs/heads/master/as/63473/ipv4-aggregated.txt,https://raw.githubusercontent.com/ipverse/asn-ip/refs/heads/master/as/16276/ipv4-aggregated.txt,https://raw.githubusercontent.com/ipverse/asn-ip/refs/heads/master/as/24940/ipv4-aggregated.txt"
:local serviceUrl "https://convert-ip-to-rsc.deno.dev/?url=$remoteUrl&name=$listName&clean&v4"
:local tmpFile "$listName.rsc"

:log info "Starting GeoIP sync for list: $listName"
do { /file remove $tmpFile } on-error={}
/tool fetch url=$serviceUrl mode=https dst-path=$tmpFile
:delay 1s

:if ([/file find name=$tmpFile] = "") do={
    :log error "Download failed: Unable to fetch file"
} else={
    :log info "Importing $tmpFile"
    do { /import file-name=$tmpFile } on-error={ :log error "Import failed: Unable to import file" }
    do { /file remove $tmpFile } on-error={}
    :log info "Sync completed for $listName"
}
```

## 接口参数

| 参数    | 必填 | 说明                                 |
|---------|------|--------------------------------------|
| url     | 是   | 数据源 URL（支持逗号分隔多个URL）    |
| name    | 否   | 地址列表名称（默认：geo-ip-list）    |
| clean   | 否   | 是否清理现有列表（存在即启用）       |
| asn     | 否   | 需要过滤的 ASN 编号（逗号分隔）      |

## 使用示例

### 基本使用
```bash
# 获取单个 IP 列表, 默认名称变为 example-list
curl "https://convert-ip-to-rsc.deno.dev/?url=https://example.com/ips.txt&name=example-list"

# 合并多个数据源
curl "https://convert-ip-to-rsc.deno.dev/?url=https://a.com/ipv4.txt,https://b.com/ipv6.txt"
```

### 带 ASN 过滤
```bash
# 仅保留 ASN 为 13335 和 2519 的记录
curl "https://convert-ip-to-rsc.deno.dev/?url=https://example.com/ip.csv&asn=13335,2519"
```

### 自动清理模式
```bash
# 先清空现有列表再添加新条目
curl "https://convert-ip-to-rsc.deno.dev/?url=https://example.com/ips.txt&clean"
```

## 数据格式要求

### 普通文本格式
```
# 支持注释
1.1.1.1/32
2606:4700::/32
```

### CSV 格式
```csv
network,autonomous_system_number,autonomous_system_organization
1.0.0.0/24,13335,CLOUDFLARENET
2a00:1190::/29,2519,ARTERIA
```
