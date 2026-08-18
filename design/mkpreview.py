import re, pathlib
FONTS='/tmp/claude-0/-home-user-takeframe-live/a09dc192-1495-5cc3-9e50-06bf8a32c6de/scratchpad/fonts'
import sys
s = pathlib.Path(sys.argv[1]).read_text()
s = s.replace('<script src="./support.js"></script>', '')
s = s.replace('<x-dc>', '').replace('</x-dc>', '')
s = s.replace('<helmet>', '').replace('</helmet>', '')
s = re.sub(r'<script data-dc-script.*?</script>', '', s, flags=re.S)
m = re.search(r'"accent"\s*:\s*\{[^}]*"default"\s*:\s*"(#[0-9A-Fa-f]{6})"', s)
accent = m.group(1) if m else '#00B0F0'
s = s.replace('{{accent}}', accent)
print('preview accent =', accent)
s = s.replace('src="./', 'src="./img/')
# swap remote font link for locally cached faces
local = pathlib.Path(FONTS+'/local.css').read_text().replace("url(./", "url("+FONTS+"/")
s = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis[^>]*>', '<style>'+local+'</style>', s)
pathlib.Path(sys.argv[2]).write_text(s)
print('preview ok', len(s))
