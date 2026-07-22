# API

## POST /api/v1/receive/file

multipart/form-data

| 参数 | 必填 | 说明 |
|------|------|------|
| `files` | 是 | 上传的文件列表 |
| `so_nos` | 是 | SO 单号列表，与文件一一对应 |

## POST /api/v1/confirm/file

x-www-form-urlencoded

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号，确认该 SO 下所有未确认文件 |

## GET /api/v1/resource/query

Query String

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号 |

## GET /api/v1/review/detail

Query String

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号 |

## POST /api/v1/review/update

Query + JSON Body

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号（Query） |
| Body | 是 | 修改后的完整 JSON 数据 |

## POST /api/v1/review/confirm

x-www-form-urlencoded

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号 |

## POST /api/v1/receive/cancel

x-www-form-urlencoded

| 参数 | 必填 | 说明 |
|------|------|------|
| `so_no` | 是 | SO 单号，删除该 SO 下 temp 目录的临时文件及数据库记录 |



