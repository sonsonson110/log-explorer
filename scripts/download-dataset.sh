#!/usr/bin/env bash

# download-dataset.sh
# Download and extract Loghub datasets from Zenodo.
# Output: ./data/<DatasetName>.log
# Usage:  ./download-dataset.sh [apache|openssh|all] ...
#         ./download-dataset.sh --list

set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────────
ZENODO_BASE="https://zenodo.org/records/8196385/files"
DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"
DOWNLOAD_TOOL=""

# ─── Dataset catalog ─────────────────────────────────────────────────────────
# Format: DISPLAY | ARCHIVE | COMPRESSED_SIZE | RAW_SIZE | LOG_IN_ARCHIVE | OUTPUT_NAME
declare -A DATASETS_DISPLAY
declare -A DATASETS_ARCHIVE
declare -A DATASETS_COMPRESSED_SIZE
declare -A DATASETS_RAW_SIZE
declare -A DATASETS_LOG_FILE
declare -A DATASETS_OUTPUT_NAME

DATASETS_DISPLAY["apache"]="Apache HTTP Server error log"
DATASETS_ARCHIVE["apache"]="Apache.tar.gz"
DATASETS_COMPRESSED_SIZE["apache"]="4.9 MB"
DATASETS_RAW_SIZE["apache"]="~24.8 MB"
DATASETS_LOG_FILE["apache"]="Apache/Apache.log"
DATASETS_OUTPUT_NAME["apache"]="Apache.log"

DATASETS_DISPLAY["openssh"]="OpenSSH daemon authentication log"
DATASETS_ARCHIVE["openssh"]="SSH.tar.gz"
DATASETS_COMPRESSED_SIZE["openssh"]="~708 MB"
DATASETS_RAW_SIZE["openssh"]="~3.08 GB"
DATASETS_LOG_FILE["openssh"]="SSH/SSH.log"
DATASETS_OUTPUT_NAME["openssh"]="OpenSSH.log"

AVAILABLE_DATASETS=("apache" "openssh")

# ─── Logging helpers ─────────────────────────────────────────────────────────
log_info()  { echo "[INFO]  $*"; }
log_ok()    { echo "[OK]    $*"; }
log_warn()  { echo "[WARN]  $*"; }
log_error() { echo "[ERROR] $*" >&2; }

# ─── Helpers ─────────────────────────────────────────────────────────────────
print_catalog() {
  echo "Available datasets:"
  echo ""
  printf "  %-12s  %-40s  %-16s  %-12s\n" "Key" "Description" "Compressed" "Raw size"
  printf "  %-12s  %-40s  %-16s  %-12s\n" "------------" "----------------------------------------" "----------------" "------------"
  for key in "${AVAILABLE_DATASETS[@]}"; do
    printf "  %-12s  %-40s  %-16s  %-12s\n" \
      "$key" "${DATASETS_DISPLAY[$key]}" "${DATASETS_COMPRESSED_SIZE[$key]}" "${DATASETS_RAW_SIZE[$key]}"
  done
  echo ""
}

detect_download_tool() {
  if command -v curl &>/dev/null; then
    DOWNLOAD_TOOL="curl"
  elif command -v wget &>/dev/null; then
    DOWNLOAD_TOOL="wget"
  else
    log_error "Neither curl nor wget found. Please install one and retry."
    exit 1
  fi
  log_info "Using download tool: ${DOWNLOAD_TOOL}"
}

download_file() {
  local url="$1"
  local dest="$2"
  if [[ "$DOWNLOAD_TOOL" == "curl" ]]; then
    curl -L --progress-bar -o "$dest" "$url"
  else
    wget --show-progress -q -O "$dest" "$url"
  fi
}

extract_archive() {
  local archive="$1"
  local extract_dir="$2"
  log_info "Extracting $(basename "$archive") ..."
  case "$archive" in
    *.tar.gz|*.tgz) tar -xzf "$archive" -C "$extract_dir" ;;
    *.zip)          unzip -q "$archive" -d "$extract_dir" ;;
    *)
      log_error "Unsupported archive format: $archive"
      exit 1
      ;;
  esac
}

# Resolve a user input (name or 1-based index) to a dataset key.
resolve_key() {
  local input="${1,,}"
  for key in "${AVAILABLE_DATASETS[@]}"; do
    [[ "$key" == "$input" ]] && { echo "$key"; return; }
  done
  if [[ "$input" =~ ^[0-9]+$ ]]; then
    local idx=$(( input - 1 ))
    if (( idx >= 0 && idx < ${#AVAILABLE_DATASETS[@]} )); then
      echo "${AVAILABLE_DATASETS[$idx]}"
      return
    fi
  fi
  echo ""
}

# ─── Main download function ───────────────────────────────────────────────────
download_dataset() {
  local key="$1"
  local archive="${DATASETS_ARCHIVE[$key]}"
  local log_in_archive="${DATASETS_LOG_FILE[$key]}"
  local output_name="${DATASETS_OUTPUT_NAME[$key]}"
  local url="${ZENODO_BASE}/${archive}?download=1"
  local output_path="${DATA_DIR}/${output_name}"

  echo ""
  echo "Dataset: ${DATASETS_DISPLAY[$key]}"
  echo "Archive: ${archive}  (${DATASETS_COMPRESSED_SIZE[$key]} compressed, ${DATASETS_RAW_SIZE[$key]} raw)"
  echo "Output:  ${output_path}"
  echo ""

  if [[ -f "$output_path" ]]; then
    log_ok "Already exists: ${output_path}"
    log_info "Delete the file and re-run to force a fresh download."
    return 0
  fi

  mkdir -p "$DATA_DIR"

  local tmp_archive
  tmp_archive=$(mktemp --suffix="-${archive}")
  # shellcheck disable=SC2064
  trap "rm -f '$tmp_archive'" EXIT

  log_info "Downloading from: ${url}"
  download_file "$url" "$tmp_archive"

  local tmp_dir
  tmp_dir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp_dir'; rm -f '$tmp_archive'" EXIT

  extract_archive "$tmp_archive" "$tmp_dir"

  local extracted_log="${tmp_dir}/${log_in_archive}"
  if [[ ! -f "$extracted_log" ]]; then
    log_warn "Expected path '${log_in_archive}' not found, searching ..."
    extracted_log=$(find "$tmp_dir" -name "*.log" ! -name "*_2k.log" | head -1)
    if [[ -z "$extracted_log" ]]; then
      log_error "Could not locate a log file inside the archive."
      exit 1
    fi
    log_info "Found log at: ${extracted_log}"
  fi

  mv "$extracted_log" "$output_path"
  rm -rf "$tmp_dir" "$tmp_archive"
  trap - EXIT

  log_ok "Dataset ready: ${output_path}"
}

# ─── Entry point ─────────────────────────────────────────────────────────────
main() {
  detect_download_tool

  local selected_keys=()

  if [[ $# -eq 0 ]]; then
    print_catalog
    echo "Enter dataset name(s) or number(s) separated by spaces (or 'all'):"
    echo -n "> "
    read -r user_input
    echo ""

    if [[ "${user_input,,}" == "all" ]]; then
      selected_keys=("${AVAILABLE_DATASETS[@]}")
    else
      read -ra tokens <<< "$user_input"
      for token in "${tokens[@]}"; do
        local key
        key=$(resolve_key "$token")
        if [[ -z "$key" ]]; then
          log_error "Unknown dataset: '${token}'. Run without arguments to see the list."
          exit 1
        fi
        selected_keys+=("$key")
      done
    fi
  else
    if [[ "$1" == "--list" || "$1" == "-l" ]]; then
      print_catalog
      exit 0
    fi

    if [[ "$1" == "all" ]]; then
      selected_keys=("${AVAILABLE_DATASETS[@]}")
    else
      for arg in "$@"; do
        local key
        key=$(resolve_key "$arg")
        if [[ -z "$key" ]]; then
          log_error "Unknown dataset: '${arg}'"
          echo ""
          print_catalog
          exit 1
        fi
        selected_keys+=("$key")
      done
    fi
  fi

  if [[ ${#selected_keys[@]} -eq 0 ]]; then
    log_error "No datasets selected."
    exit 1
  fi

  local failed=()
  for key in "${selected_keys[@]}"; do
    if ! download_dataset "$key"; then
      failed+=("$key")
    fi
  done

  echo ""
  if [[ ${#failed[@]} -gt 0 ]]; then
    log_error "Failed datasets: ${failed[*]}"
    exit 1
  fi

  echo "All done! Log files are in: ${DATA_DIR}"
}

main "$@"
