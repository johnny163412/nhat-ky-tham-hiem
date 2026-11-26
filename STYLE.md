# Cách kể chuyện cho Nhật Ký Thám Hiểm

Mẫu chính: [loạt "100 người ảnh hưởng nhất lịch sử" trên Tinh tế](https://tinhte.vn/thread/100-nguoi-anh-huong-nhat-lich-su-15-moses-nguoi-lap-phap-ma-khao-co-hoc-chua-tim-thay-dau-vet.4195233/) (bài Moses). Bài hay không nhờ tính từ, mà nhờ chi tiết thật, xếp đúng chỗ.

## Đọc thêm để học giọng kể

- Smithsonian Magazine, mục History: chuyện ít người biết, có nhân chứng, có con số.
- Atlas Obscura: một địa điểm, một chi tiết lạ, kể từ cảnh cụ thể.
- Damn Interesting: chuyện dài, kịch tính, mỗi đoạn kết bằng một câu hỏi kéo người đọc đi tiếp.
- The Public Domain Review: kể quanh một hiện vật, một bức ảnh hay một văn bản cũ.
- JSTOR Daily và History Today: cho thấy giới sử học đang tranh luận gì.
- Sách Việt: Đại Việt sử ký toàn thư, Việt Nam sử lược của Trần Trọng Kim, Hoàng Lê nhất thống chí. Dẫn đúng tên sách khi dùng.

## Khung một câu chuyện (khoảng 600 đến 1.000 chữ)

1. **Mở bằng một cảnh hoặc một mâu thuẫn**, không mở bằng định nghĩa. Một người, một ngày, một hành động. Câu thứ hai nói vì sao chuyện này đáng đọc.
2. **Ba đến năm mục có tiêu đề** (dòng bắt đầu bằng `## ` trong `story`). Mỗi mục trả lời một câu hỏi người đọc đang tò mò.
3. **Tách truyền thống và bằng chứng.** Luôn có một mục kiểu "Bằng chứng nói gì" hoặc "Sử sách chép gì". Viết rõ: "theo Herodotus", "Toàn thư chép", "chưa có nguồn đương thời nào".
4. **Chi tiết cụ thể thay cho tính từ.** Ngày tháng, con số, tên người, tên sách, số hiệu hiện vật. Không viết "vô cùng kinh hoàng", mà viết "khoảng 1.300 người chết trong một buổi chiều".
5. **Một chi tiết bất ngờ bên lề**, như chữ keren vừa là "sừng" vừa là "tia sáng" nên tượng Moses có sừng.
6. **Dư âm đến hôm nay.** Câu chuyện còn để lại gì: một từ, một bảo tàng, một bài hát, một cuộc tranh luận.
7. **Kết bằng một câu cân bằng**, không kết bằng câu cảm thán.

## Giọng văn

- Câu ngắn, khẳng định. Một ý một câu.
- Trung tính, không thần thánh hóa, không chế giễu. Có thể dí dỏm nhờ chính sự kiện.
- Không bịa lời thoại. Chỉ trích lời khi có nguồn, và ghi rõ ai nói.
- Con số không chắc thì ghi "khoảng" và ghi ai ước tính.
- Không dùng gạch ngang dài. Dùng dấu phẩy, dấu hai chấm hoặc tách câu.

## Dữ liệu

- `story`: các đoạn văn. Dòng bắt đầu bằng `## ` là tiêu đề mục. Đoạn đầu tiên luôn là văn xuôi (để có chữ cái lớn đầu bài).
- `sources`: danh sách `{"label": "...", "url": "..."}`. Chỉ ghi nguồn đã mở được; `check_cards.py --links` sẽ kiểm tra.
- `images`: 2 đến 4 ảnh từ Wikimedia Commons. Chú thích như bài mẫu: ảnh gì, ở đâu, năm nào, vì sao đáng nhìn (một câu cụ thể, không chỉ "Ảnh minh họa"). `credit` ghi tác giả và giấy phép đúng như trang Commons.
- `verdictNote`: một câu, nói rõ phần nào có thật, phần nào là truyền thuyết.
