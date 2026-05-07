#!/bin/bash
# memos.sh — Memos API 统一脚本（笔记 CRUD + 附件上传）
# 适配 Memos v0.22+（/api/v1/memos + /api/v1/attachments）
set -euo pipefail

# ── 凭证加载 ──────────────────────────────────────────────
source "$HOME/.homelab-skills/load-env.sh"
load_env_file || exit 1
if [[ -z "${MEMOS_URL:-}" ]] || [[ -z "${MEMOS_API_TOKEN:-}" ]]; then
    echo '{"error": "Missing MEMOS_URL or MEMOS_API_TOKEN in ~/.homelab-skills/.env"}' >&2
    exit 1
fi

API="${MEMOS_URL}/api/v1"
AUTH="Authorization: Bearer ${MEMOS_API_TOKEN}"

# ── 通用请求函数 ──────────────────────────────────────────
# api <method> <endpoint> [json_data]
# 使用 temp file 传 JSON，避免 Windows 下 UTF-8 乱码和参数过长
api() {
    local method="$1" endpoint="$2" data="${3:-}"
    local args=(-s -X "$method" -H "$AUTH" -H "Content-Type: application/json")
    local tmp=""
    if [[ -n "$data" ]]; then
        tmp=$(mktemp /tmp/memos_XXXXXX.json)
        echo "$data" > "$tmp"
        args+=(-d @"$tmp")
    fi
    local out
    out=$(curl "${args[@]}" "${API}${endpoint}") || {
        # curl 本身失败（网络问题等）是致命错误
        echo "{\"error\":\"curl failed\",\"url\":\"${API}${endpoint}\"}" >&2
        exit 1
    }
    [[ -n "$tmp" ]] && rm -f "$tmp"
    echo "$out"
}

# ── memo 操作 ─────────────────────────────────────────────

# memo.create <content> [--visibility PRIVATE|PUBLIC]
cmd_memo_create() {
    local content="$1"; shift
    local visibility="PRIVATE"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --visibility) visibility="$2"; shift 2 ;;
            *) echo "{\"error\":\"Unknown option: $1\"}" >&2; exit 1 ;;
        esac
    done
    local payload
    payload=$(jq -n --arg c "$content" --arg v "$visibility" \
        '{content:$c, visibility:$v}')
    api POST "/memos" "$payload"
}

# memo.list [--limit N] [--filter "expr"]
cmd_memo_list() {
    local limit=50 filter=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --limit)  limit="$2";   shift 2 ;;
            --filter) filter="$2";  shift 2 ;;
            *) echo "{\"error\":\"Unknown option: $1\"}" >&2; exit 1 ;;
        esac
    done
    local qs="pageSize=${limit}"
    [[ -n "$filter" ]] && qs+="&filter=$(printf '%s' "$filter" | jq -sRr @uri)"
    api GET "/memos?${qs}"
}

# memo.get <id>
cmd_memo_get() {
    local id="${1#memos/}"
    api GET "/memos/${id}"
}

# memo.update <id> <content> [--visibility PRIVATE|PUBLIC]
cmd_memo_update() {
    local id="${1#memos/}"; shift
    local content="" visibility="" fields=()
    # first non-flag arg is content
    if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
        content="$1"; shift
    fi
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --visibility) visibility="$2"; shift 2 ;;
            *) echo "{\"error\":\"Unknown option: $1\"}" >&2; exit 1 ;;
        esac
    done
    local payload="{"
    if [[ -n "$content" ]]; then
        payload+="\"content\":$(jq -n --arg c "$content" '$c')"
        fields+=("content")
    fi
    if [[ -n "$visibility" ]]; then
        [[ ${#fields[@]} -gt 0 ]] && payload+=","
        payload+="\"visibility\":\"$visibility\""
        fields+=("visibility")
    fi
    payload+="}"
    local mask
    mask=$(IFS=,; echo "${fields[*]}")
    if [[ -z "$mask" ]]; then
        echo '{"error":"Nothing to update"}' >&2; exit 1
    fi
    api PATCH "/memos/${id}?updateMask=${mask}" "$payload"
}

# memo.delete <id>
cmd_memo_delete() {
    local id="${1#memos/}"
    api DELETE "/memos/${id}"
}

# memo.archive <id>
cmd_memo_archive() {
    local id="${1#memos/}"
    api PATCH "/memos/${id}?updateMask=state" '{"state":"ARCHIVED"}'
}

# ── 附件操作 ─────────────────────────────────────────────

# upload <file> [--memo-id <id>]
# 文件以 base64 编码放入 JSON，POST 到 /api/v1/attachments
cmd_upload() {
    local file_path="$1"; shift
    if [[ ! -f "$file_path" ]]; then
        echo "{\"error\":\"File not found: $file_path\"}" >&2; exit 1
    fi
    local memo_id=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --memo-id) memo_id="$2"; shift 2 ;;
            *) echo "{\"error\":\"Unknown option: $1\"}" >&2; exit 1 ;;
        esac
    done

    local filename
    filename=$(basename "$file_path")
    local file_size
    file_size=$(wc -c < "$file_path" | tr -d ' ')
    local mime_type
    mime_type=$(file -b --mime-type "$file_path" 2>/dev/null || echo "application/octet-stream")

    # base64 → temp file → jq --rawfile（避免参数过长）
    local b64_tmp
    b64_tmp=$(mktemp /tmp/memos_b64_XXXXXX.txt)
    base64 -w0 "$file_path" > "$b64_tmp" 2>/dev/null || base64 < "$file_path" > "$b64_tmp"

    local tmp
    tmp=$(mktemp /tmp/memos_upload_XXXXXX.json)
    jq -n \
        --arg filename "$filename" \
        --arg type "$mime_type" \
        --argjson size "$file_size" \
        --rawfile content "$b64_tmp" \
        '{filename:$filename, type:$type, size:$size, content:$content}' \
        > "$tmp"
    rm -f "$b64_tmp"

    local result
    result=$(api POST "/attachments" "$(cat "$tmp")")
    rm -f "$tmp"

    # 如果指定了 memo-id，把附件挂上去
    if [[ -n "$memo_id" ]]; then
        local attach_name
        attach_name=$(echo "$result" | jq -r '.name // empty')
        if [[ -n "$attach_name" ]]; then
            local memo_id_stripped="${memo_id#memos/}"
            local memo_data
            memo_data=$(api GET "/memos/${memo_id_stripped}")
            local existing
            existing=$(echo "$memo_data" | jq -c '.attachments // [] | map({name:.name})')
            local merged
            merged=$(echo "$existing" | jq --arg n "$attach_name" '. + [{name:$n}]')
            local update_tmp
            update_tmp=$(mktemp /tmp/memos_att_XXXXXX.json)
            echo "$memo_data" | jq --argjson a "$merged" '. + {attachments:$a}' > "$update_tmp"
            api PATCH "/memos/${memo_id_stripped}?updateMask=content,visibility,attachments" "$(cat "$update_tmp")" > /dev/null
            rm -f "$update_tmp"
        fi
    fi
    echo "$result"
}

# attachment.get <name>
cmd_attach_get() {
    local name="${1#attachments/}"
    api GET "/attachments/${name}"
}

# attachment.delete <name>
cmd_attach_delete() {
    local name="${1#attachments/}"
    api DELETE "/attachments/${name}"
}

# ── 用法 ─────────────────────────────────────────────────
usage() {
    cat <<'EOF'
Usage: memos.sh <command> [args]

Memo commands:
  memo.create  <content> [--visibility PRIVATE|PUBLIC]
  memo.list    [--limit N] [--filter "expr"]
  memo.get     <id>
  memo.update  <id> <content> [--visibility ...]
  memo.delete  <id>
  memo.archive <id>

Attachment commands:
  upload           <file> [--memo-id <id>]
  attachment.get   <name>
  attachment.delete <name>

IDs: memo ID can be "abc123" or "memos/abc123"
     attachment name can be "xyz" or "attachments/xyz"
EOF
}

# ── 调度 ─────────────────────────────────────────────────
main() {
    [[ $# -eq 0 ]] && { usage; exit 1; }
    local cmd="$1"; shift
    case "$cmd" in
        memo.create)    cmd_memo_create "$@" ;;
        memo.list)      cmd_memo_list "$@" ;;
        memo.get)       cmd_memo_get "$@" ;;
        memo.update)    cmd_memo_update "$@" ;;
        memo.delete)    cmd_memo_delete "$@" ;;
        memo.archive)   cmd_memo_archive "$@" ;;
        upload)         cmd_upload "$@" ;;
        attachment.get)    cmd_attach_get "$@" ;;
        attachment.delete) cmd_attach_delete "$@" ;;
        -h|--help|help) usage ;;
        *) echo "{\"error\":\"Unknown command: $cmd\"}" >&2; usage; exit 1 ;;
    esac
}

main "$@"
