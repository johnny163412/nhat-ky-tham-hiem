# Nhật Ký Thám Hiểm

Web app (PWA) để khám phá những chuyện lịch sử ít ai biết. Không cần build, không cần server riêng.

Chạy thử:

```bash
python3 -m http.server 8765
```

Rồi mở http://localhost:8765.

- Trang chính là bản đồ màu nước (Stamen Watercolor qua Stadia Maps). Trên localhost không cần key; trước khi đưa lên web phải đăng ký tên miền ở stadiamaps.com (có gói miễn phí).
- Biên giới lịch sử lấy từ [historical-basemaps](https://github.com/aourednik/historical-basemaps), giấy phép GPL-3.0, được tải qua jsDelivr và ghim theo commit. Mỗi nấc trên thanh thời gian là một mốc bản đồ (`SNAPS` trong `app.js`); câu chuyện thuộc mốc gần nhất trước năm của nó.
- Nội dung nằm trong `cards.json`. Mỗi thẻ cần `lat`/`lng` để hiện trên bản đồ. Mỗi thẻ có `verdict` là `that` (đã xác thực), `don` (lời đồn) hoặc `chuaro` (chưa rõ), và `wiki` có dạng `en:Tiêu_đề` hoặc `vi:Tiêu_đề`.
- Cách viết một câu chuyện (khung, giọng văn, nguồn tham khảo) nằm trong [STYLE.md](STYLE.md). Trong `story`, dòng bắt đầu bằng `## ` là tiêu đề mục; trường `sources` là danh sách nguồn; trường `images` là ảnh minh họa `{file: "File:…" trên Commons, caption, credit}`, ảnh đầu tiên đặt ở đầu trang và làm ảnh thẻ trong Nhật ký, ảnh thứ k (k ≥ 1) nằm dưới tiêu đề mục thứ k.
- Sau khi sửa thẻ, chạy `python3 check_cards.py --links` để kiểm tra dữ liệu và link.
- Thêm ảnh mới thì chạy `python3 fetch_images.py` (cần `cwebp`: `brew install webp`): tải bản sao WebP về `img/` và ghi trường `img` vào `cards.json`, để trang không phụ thuộc vào tốc độ của Commons. Ảnh nào chưa tải được vẫn lấy thẳng từ Commons; chạy lại lệnh để tải bù.
- Rồi chạy `python3 build_pages.py https://<địa-chỉ-trang>/` để tạo lại trang tĩnh `c/<id>.html` (xem trước khi chia sẻ Zalo/Facebook, cho Google tìm thấy), `sitemap.xml` và `robots.txt`. Không truyền địa chỉ thì chỉ tạo trang, bỏ qua sitemap.
- `glossary.json`: từ khó và lời chú. Lần đầu một từ xuất hiện trong chuyện (trừ đoạn mở đầu) sẽ thành chữ gạch chấm, chạm vào hiện chú thích. Tránh từ nằm lọt trong cụm dài hơn (như "Tây Dương" trong "Đại Tây Dương").
- Trường `pull` (tùy chọn) là câu trích nổi bật, phải chép nguyên văn từ thân chuyện; `w`/`h` của ảnh là kích thước gốc trên Commons, giữ chỗ để chữ không nhảy.
- Trường `date` (tùy chọn, dạng `MM-DD`) là ngày xảy ra sự kiện trong năm `year`; chuyện nào trong vòng 3 ngày quanh hôm nay sẽ lên "Ngày này năm xưa".

- `kind`: loại truyện, quyết định ký hiệu trên dấu ghim và huy hiệu hộ chiếu: `bian` (bí ẩn), `tran` (chiến trận), `bien` (biển cả), `vua` (vua chúa), `khampha` (khám phá), `doi` (đời thường).
- Hành trình (`JOURNEYS`), tên đại dương (`OCEANS`) và bản đồ cổ (`OLD_MAPS`) khai báo ngay đầu phần bản đồ trong `app.js`. Bản đồ cổ thế giới lấy từ Allmaps (David Rumsey Map Collection); bản đồ Taberd 1838 đặt theo khung ước lượng.
- Núi, đồi, cồn cát, rừng trên bản đồ là biểu tượng của [Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) (MIT, xem `relief/LICENSE`), rải lên đúng các dãy núi, sa mạc, rừng thật theo Natural Earth. Muốn đổi mật độ hay vùng thì sửa `make_relief.py` rồi chạy `python3 make_relief.py` để tạo lại `relief.json` và `coast.json` (đường bờ biển giản lược, dùng vẽ sóng gợn quanh bờ).
- Hoa văn góc khung `frame-corner.svg`: S. H. Redmond, phạm vi công cộng, lấy từ Wikimedia Commons.
- Rồng biển, cá heo, Triton, thuyền buồm (`sea/`, vị trí ở `SEA_ART` trong `app.js`): hình khắc huy hiệu của Fox-Davies 1904 và Jérôme de Bara 1581, phạm vi công cộng, Wikimedia Commons. Dải băng tên bản đồ `sea/ribbon.png`: Scroll-Ribbon của Christopher J. Fynn (CC0), đã tô nền giấy bên trong.
- Đố năm (`#/do`): mỗi ngày một chuyện, chọn theo ngày nên ai cũng cùng câu; kết quả lưu ở khóa `nhatky-do` trong trình duyệt.
