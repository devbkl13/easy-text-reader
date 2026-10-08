# Khoảng đọc

Công cụ biến bài viết thuần văn bản thành một trang dễ đọc trên desktop và mobile. HTML, CSS và JavaScript thuần; không server, API, thư viện hay tài khoản. Font Google Fonts được đóng gói cục bộ, không tải từ mạng khi sử dụng.

## Xuất bản trên GitHub Pages

Repo có sẵn workflow `.github/workflows/pages.yml`. Mỗi lần push lên `master`, site tự được triển khai tại `https://devbkl13.github.io/easy-text-reader/` (bản độc lập tại `/easy-text-reader-standalone.html`).

Thiết lập một lần: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Mở và sử dụng

**Mở `easy-text-reader-standalone.html` bằng trình duyệt.** Đây là bản độc lập chứa cả giao diện, bộ định dạng và bài mẫu. Có thể chép riêng file này sang máy khác, không cần cài Node.js.

Hoặc mở `index.html` trong thư mục hiện tại; giữ `styles.css`, `fonts.js`, `formatter.js`, `app.js` và `sample.js` bên cạnh.

1. Thay bài mẫu bằng văn bản bạn dán vào, hoặc bấm **Dán từ clipboard** để dán nhanh nội dung đã sao chép (trình duyệt có thể hỏi quyền đọc clipboard).
2. Bản xem trước tự cập nhật sau khi bạn ngừng gõ. **Tạo khoảng đọc** cập nhật ngay; trên màn hình nhỏ, nút này đưa bạn đến bản xem trước.
3. Tiêu đề hiển thị là tùy chọn. Nếu để trống, công cụ dùng tiêu đề nhận diện được hoặc “Bài viết của bạn”. Nếu bạn đặt tên khác, tiêu đề gốc vẫn được giữ trong bài.
4. Bật **Kiểm tra nhận diện** để xem dấu hiệu và dòng nguồn, đổi đoạn thành đề mục/trích dẫn/ý cần chú ý hoặc hoàn tác từng lựa chọn.
5. Mở **Chế độ đọc**: mục lục, tiến độ đọc, cỡ chữ, giãn dòng, 5 kiểu font và 5 theme. Trong **Hiển thị**, chọn Chân chữ, Không chân, **Be Vietnam Pro**, **Manrope** hoặc Monospace; màu trang gồm Giấy, Trắng, Ban đêm, Giấy ấm và Sương xanh. Hai font từ Google Fonts được lưu cục bộ và nhúng cả vào bản app một file lẫn bài HTML xuất ra. Các kiểu Chân chữ, Không chân và Monospace dùng font có sẵn trên thiết bị. Lựa chọn Times New Roman/Tahoma từ phiên bản cũ tự chuyển sang Be Vietnam Pro/Manrope.
6. **Lưu HTML** tải bài đọc thành một file riêng, chứa toàn bộ định dạng, không cần app để đọc. Nút máy in dùng hộp thoại in của trình duyệt; có thể chọn lưu PDF nếu trình duyệt hỗ trợ.
7. Bấm **Focus** trong thanh công cụ đọc, hoặc nhấn **F**, để chỉ hiển thị nội dung bài viết. Thanh đầu trang, mục lục, nút công cụ, thông tin phụ và phần cuối trang được ẩn. Dùng nút **Thoát Focus**, **Esc** hoặc **F** để trở lại; vị trí đoạn đang đọc được giữ lại. Phím F không kích hoạt khi đang nhập nội dung hoặc điều chỉnh ô chọn. Focus áp dụng cho phiên đọc hiện tại; font và theme vẫn được lưu như trước.
8. Trong **Hiển thị → Rộng bài**, điều chỉnh chiều rộng tối đa từ **480 đến 1.040px**, mặc định 720px. Áp dụng cho chế độ đọc, Focus và bài HTML xuất ra; được lưu cùng các thiết lập khác. Nội dung tự co khi màn hình hoặc phần không gian còn lại nhỏ hơn giá trị đã chọn.

Bảng **Hiển thị** giữ nguyên vị trí trên màn hình khi chỉnh độ rộng, để thanh trượt không di chuyển theo vùng bài viết. Vị trí bảng được tính lại khi mở hoặc đổi kích thước cửa sổ; bảng tự giới hạn chiều cao và cuộn được trên màn hình nhỏ.

Đoạn văn thông thường và khối nhấn mạnh được căn đều hai bên (`justify`), dòng cuối vẫn căn trái. Tiêu đề, danh sách, thơ, trích dẫn, đoạn cần giữ ngắt dòng và khối mã giữ cách căn trái để bảo toàn cấu trúc. Quy tắc này áp dụng cho bản xem trước, chế độ đọc, Focus và bài HTML xuất ra.

Trên điện thoại, mở công cụ bằng trình duyệt có JavaScript. Trình xem trước tệp của hệ điều hành có thể không chạy công cụ. File bài đọc xuất ra không cần JavaScript.

## Cơ chế nhận diện

Quyết định dựa trên nhiều dấu hiệu kết hợp, không chỉ tìm dấu đầu dòng:

| Dấu hiệu | Cách xử lý |
| --- | --- |
| `1. Chủ đề` rồi đến đoạn giải thích dài | Đề mục có số; sinh mục lục |
| Nhiều dòng `1.`, `2.`, `3.` liền nhau | Danh sách; giữ số gốc kể cả khi không liên tục |
| `a)`, `B.`, ký hiệu `+`, `-`, `•`, `✅`, `👉`, `🔹`… | Danh sách chữ/số hoặc gạch đầu dòng; giữ biểu tượng có ý nghĩa |
| `PHẦN 1:`, `Bước 2 —`, `II.`, `1️⃣` kèm đoạn giải thích | Đề mục theo ngữ cảnh |
| Markdown `#`, `##`, dòng gạch chân `===`/`---` | Tiêu đề hoặc đề mục |
| Dòng ngắn viết hoa, chữ Unicode cách điệu, tiêu đề đứng riêng | Nhận diện khi đủ dấu hiệu về độ dài và vị trí |
| `Lưu ý:`, `Ý quan trọng nhất:`, `Tóm lại:`… | Khối nhấn mạnh |
| `>` hoặc một đoạn nằm trọn trong ngoặc kép | Trích dẫn |
| `**đậm**`, `*nghiêng*`, mã nội dòng, liên kết HTTP(S) | Định dạng nội dòng an toàn |
| Hàng rào mã, danh sách `[x]`/`[ ]`, dòng phân cách | Giữ cấu trúc tương ứng |
| Đoạn từ 640 ký tự, có nhiều câu | Thêm khoảng nghỉ ở ranh giới câu; tránh viết tắt, số thập phân, URL, câu nằm trong ngoặc kép |
| Các dòng ngắt giữa câu theo chiều rộng cố định | Nối lại khi đủ bằng chứng |
| Nhóm dòng ngắn giống thơ | Giữ xuống dòng |

**Linh hoạt** bật các suy đoán dựa trên chữ hoa, vị trí, trích dẫn trong ngoặc kép và nhãn nhấn mạnh. **Thận trọng** ưu tiên cấu trúc rõ ràng, giảm các suy đoán này. Có thể tắt riêng việc chia đoạn dài.

Công cụ không tóm tắt, thêm ý hay sửa câu. Bộ quy tắc không hiểu ý nghĩa như người đọc: văn bản thiếu mọi dấu hiệu cấu trúc sẽ chủ yếu được giữ thành đoạn văn. Markdown chỉ được hỗ trợ ở các dạng phổ biến nêu trên; bảng, HTML nhúng và hệ thống danh sách lồng nhau phức tạp chưa có bộ phân tích chuyên biệt. Dùng phần kiểm tra nhận diện hoặc sửa nguồn khi cần.

## Dữ liệu và lưu trữ

Văn bản, tiêu đề, lựa chọn sửa định dạng, vị trí đọc và thiết lập hiển thị được lưu trong `localStorage` của trình duyệt. Không có yêu cầu HTTP, theo dõi hay đồng bộ dữ liệu. Nút thùng rác xóa bài đang soạn và cập nhật bản nháp thành rỗng.

Việc lưu bản nháp tùy quyền và cách trình duyệt xử lý file cục bộ; giao diện báo nếu không lưu được. Bản nháp không thay thế file xuất khi bạn muốn giữ lâu dài hoặc chuyển thiết bị. Xóa dữ liệu trình duyệt sẽ xóa bản nháp.

Văn bản chứa HTML được hiển thị như chữ, không thực thi. Chỉ URL HTTP(S) được biến thành liên kết; việc mở liên kết do người đọc chủ động thực hiện.

## Mã nguồn và kiểm tra

| File | Vai trò |
| --- | --- |
| `index.html`, `styles.css` | Giao diện responsive và bố cục đọc/in |
| `formatter.js` | Bộ phân tích và dựng nội dung an toàn; chạy độc lập với DOM |
| `app.js` | Soạn, xem trước, sửa nhận diện, lưu nháp, đọc và xuất HTML |
| `assets/fonts/` | Font WOFF2, giấy phép OFL, URL nguồn và SHA-256 |
| `fonts.js` | Font và giấy phép nhúng, sinh từ các tệp WOFF2 cục bộ |
| `sample.txt`, `sample.js` | Mẫu gốc và bản nhúng để mở qua `file://` |
| `easy-text-reader-standalone.html` | Bản app đóng gói trong một file |
| `scripts/build-portable.cjs` | Tạo lại bản độc lập từ mã nguồn và `sample.txt` |
| `scripts/build-fonts.cjs` | Kiểm tra SHA-256 và tạo lại `fonts.js`, không cần mạng |
| `scripts/vendor-fonts.py` | Tải nguồn chính thức, kiểm tra ký tự tiếng Việt và chuyển TTF thành WOFF2 khi cần cập nhật font |
| `tests/formatter.test.cjs` | Các trường hợp nhận diện, bảo toàn nội dung và dựng HTML an toàn |
| `tests/browser.test.cjs` | Kiểm tra trình duyệt offline và tạo ảnh giao diện |
| `tests/width-slider.test.cjs` | Kéo chuột liên tục hai hướng, kiểm tra thanh không di chuyển theo vùng đọc, thao tác bàn phím và đổi kích thước cửa sổ trên cả hai bản app |
| `artifacts/` | Ảnh desktop/mobile và bài mẫu đã xuất thành HTML |

Chỉ việc phát triển/kiểm tra mới cần Node.js:

```powershell
node --test tests/formatter.test.cjs
node scripts/build-portable.cjs
```

Lệnh đóng gói tự tạo lại `fonts.js` từ font đã có trong `assets/fonts/`; không tải gì từ mạng. Nguồn font, giấy phép và cách cập nhật nằm trong [assets/fonts/README.md](assets/fonts/README.md).

Kiểm tra giao diện cần một bản Playwright cài sẵn và Chrome. Nếu Playwright không nằm trên đường dẫn tìm module, đặt `PLAYWRIGHT_MODULE` thành đường dẫn đến thư mục gói `playwright`, rồi chạy:

```powershell
node tests/browser.test.cjs
node tests/width-slider.test.cjs
```

Đã kiểm tra bằng Chrome qua `file://`, mạng bị tắt: bài mẫu nhận đúng 4 đề mục, 1 danh sách gồm 2 mục, 1 ý nhấn mạnh; không mất lời văn sau khi chuẩn hóa khoảng trắng. Đã kiểm tra mục lục, sửa nhận diện và hoàn tác, bản nháp sau tải lại, nhập tệp, tải bài HTML, bản app một file, xử lý HTML nguy hiểm, giao diện 1440px/390px/320px và không tràn ngang. Kiểm tra font thực tế qua Chrome DevTools xác nhận chữ tiếng Việt trong đoạn mẫu dùng font WOFF2 nhúng, không phải font dự phòng. Font, theme và chiều rộng được nhớ sau tải lại và xuất đúng vào HTML; bản app một file chứa đầy đủ font. Đã kiểm tra căn đều đoạn thường và ngoại lệ cho thơ, trích dẫn, danh sách, đề mục và mã. Focus đã kiểm tra việc ẩn/hiện control, phím F/Esc, nút thoát trên mobile, giữ vị trí đoạn đọc và hoạt động trong bản app một file. Kiểm tra mobile là mô phỏng viewport trình duyệt, chưa phải thử trên điện thoại thật.
