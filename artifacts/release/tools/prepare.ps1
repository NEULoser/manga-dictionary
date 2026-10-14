$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
New-Item -ItemType Directory -Force downloads,extension/vendor/core,extension/vendor/dict,extension/data,extension/licenses | Out-Null
function Download-Resource($url, $target) {
  & curl.exe -fL --retry 3 --retry-all-errors --max-time 240 $url -o $target
  if ($LASTEXITCODE -ne 0) { throw "Download failed: $target" }
}
$packages = @(
  @('tesseract','https://registry.npmjs.org/tesseract.js/-/tesseract.js-6.0.1.tgz'),
  @('core','https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.0.0.tgz'),
  @('kuromoji','https://registry.npmjs.org/kuromoji/-/kuromoji-0.1.2.tgz'),
  @('opencc','https://registry.npmjs.org/opencc-js/-/opencc-js-1.0.5.tgz')
)
foreach ($p in $packages) {
  Download-Resource $p[1] "downloads/$($p[0]).tgz"
  New-Item -ItemType Directory -Force "downloads/$($p[0])" | Out-Null
  & tar.exe -xf "downloads/$($p[0]).tgz" -C "downloads/$($p[0])"
  if ($LASTEXITCODE -ne 0) {throw "Extraction failed: $($p[0])"}
}
Copy-Item downloads/tesseract/package/dist/tesseract.min.js,downloads/tesseract/package/dist/worker.min.js extension/vendor
Copy-Item downloads/tesseract/package/LICENSE.md extension/licenses
Copy-Item downloads/tesseract/package/dist/*.LICENSE.txt extension/licenses
Copy-Item downloads/core/package/*.wasm* extension/vendor/core
Copy-Item downloads/core/package/LICENSE extension/licenses/tesseract-core-LICENSE.txt
Copy-Item downloads/kuromoji/package/build/kuromoji.js extension/vendor
Copy-Item downloads/kuromoji/package/dict/*.gz extension/vendor/dict
Copy-Item downloads/kuromoji/package/LICENSE-2.0.txt extension/licenses/kuromoji-LICENSE.txt
Copy-Item downloads/opencc/package/dist/umd/t2cn.js extension/vendor
Copy-Item downloads/opencc/package/LICENSE extension/licenses/opencc-LICENSE.txt
foreach ($lang in @('eng','jpn','jpn_vert')) {
  Download-Resource "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/$lang.traineddata" "extension/data/$lang.traineddata"
}
Download-Resource 'https://kaikki.org/zhwiktionary/%E6%97%A5%E8%AF%AD/kaikki.org-dictionary-%E6%97%A5%E8%AF%AD.jsonl' 'downloads/ja-s.jsonl'
Download-Resource 'https://kaikki.org/zhwiktionary/%E6%97%A5%E8%AA%9E/kaikki.org-dictionary-%E6%97%A5%E8%AA%9E.jsonl' 'downloads/ja-t.jsonl'
Download-Resource 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv' 'downloads/ecdict.csv'
Download-Resource 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE' 'extension/licenses/ECDICT-LICENSE.txt'
Download-Resource 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/LICENSE' 'extension/licenses/tessdata-LICENSE.txt'
Download-Resource 'https://cdn.jsdelivr.net/gh/taku910/mecab@master/mecab-ipadic/COPYING' 'extension/licenses/IPADIC-COPYING.txt'
Write-Host 'Resources downloaded. Run npm run build:dictionaries, then npm test.'
