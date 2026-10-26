# 여행 앱 (static, GitHub Pages)

폰 홈 화면에 붙여 쓰는 여행 동선 앱. 화면 코드(`index.html`, `app.css`, `app.js`)는 나라와 무관하고,
여행 하나 = `trips/<id>.json` 하나. 새 여행은 JSON만 추가하고 `trips/index.json`에 한 줄 넣으면 끝.

## trips/index.json
```json
{"trips":[{"id":"kyoto-2026","title":"교토 6일","subtitle":"교토 · 이네 · 나라","dates":"2026-10-31 ~ 2026-11-05","country":"JP","countryName":"일본","file":"trips/kyoto-2026.json"}]}
```

## trips/<id>.json
| 키 | 뜻 |
|---|---|
| `title, subtitle, dates, timezone, tzNote, currency` | 표시용 |
| `home {name, address, q, note}` | 숙소. `q`는 구글맵 검색어 |
| `transit {card, kit[]}` | 교통카드 이름, 교통 요약(아이콘은 Material Symbols 이름) |
| `phrases [[한국어, 현지어, 발음]]` | 한마디 시트 |
| `returnCalc {label, steps[[이름, 분]], hint}` | 귀국일 역산 (선택) |
| `days[]` | 아래 |

### day
`{id, d:"10/31", w:"토", title, city, home:"18:30 숙소", flight:true?, items[]}`

### item — 장소 `k:"p"`
`t` 시각 · `st` 상태(`user` 내가 정함 / `tt` 공식 시간표 / `est` 예상 / `v` 확인 필요) · `name` · `ja` 현지어(한글 발음 · 로마자) ·
`what` 뭐 하는 곳 · `why` 왜/얼마나 · `tags[]` 영업시간·요금 · `todo[]` · `q` 구글맵 검색어 ·
`lat,lng,h` 로드뷰 좌표(확실할 때만; 없으면 `approx:true` → 지도로 대체)

### item — 이동 `k:"l"`
`from,to` · `q1,q2` 길찾기용 검색어 · `steps[{icon, text, sub, time, fare}]` (icon: `train, directions_bus, directions_walk, subway, tram, local_taxi, directions_boat`) ·
`total` ("… · Suica OK" 포함 시 카드 배지) · `alt` 대안 · `note`

### 규칙
- 현지어 지명은 반드시 `현지어(한글 발음 · 로마자)` 병기.
- 좌표는 확실한 랜드마크만. 모르면 비우고 `approx:true`.
- 확정 안 된 시각·요금은 `st:"est"`/`"v"` 로 두고 "확인" 문구.
