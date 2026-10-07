# Font tự host cho Khoảng đọc

Hai font từ kho chính thức [Google Fonts](https://github.com/google/fonts), đã lưu tại đây và được đóng gói để sử dụng hoàn toàn offline:

| Font | Nguồn | Các kiểu được đóng gói |
| --- | --- | --- |
| [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro) | [google/fonts/ofl/bevietnampro](https://github.com/google/fonts/tree/main/ofl/bevietnampro) | Regular 400, Italic 400, SemiBold 600, Bold 700 |
| [Manrope](https://fonts.google.com/specimen/Manrope) | [google/fonts/ofl/manrope](https://github.com/google/fonts/tree/main/ofl/manrope) | Variable, trọng lượng 200–800, normal |

Giữ nguyên bộ ký tự của font gốc, gồm tiếng Việt. Chỉ chuyển định dạng TTF → WOFF2 để nén; không cắt bộ ký tự hay thay nét chữ. Bản Manrope trên Google Fonts không có kiểu italic riêng; trình duyệt có thể tạo nét nghiêng khi nội dung yêu cầu.

Hai font dùng giấy phép **SIL Open Font License 1.1**. Giấy phép và thông tin tác giả được giữ trong `bevietnampro-OFL.txt`, `manrope-OFL.txt`, đồng thời nhúng vào CSS của bản app một file và bài HTML xuất ra khi dùng font tương ứng.

`manifest.json` ghi URL nguồn chính thức, SHA-256 của TTF đã tải và WOFF2 cục bộ. Bản đóng gói kiểm tra checksum trước khi nhúng. Không cần cài font vào hệ điều hành.

## Đóng gói offline

Từ thư mục gốc của app:

```powershell
node scripts/build-portable.cjs
```

Lệnh này tạo lại `fonts.js` và `khoang-doc.html` từ các file đã có, không cần mạng. Font được nhúng dưới dạng `data:font/woff2` để `file://`, bản app một file và bài đọc xuất ra không phụ thuộc đường dẫn font bên ngoài.

## Cập nhật nguồn font

Chỉ khi muốn tải lại bản từ Google Fonts, dùng Python có `fonttools` và `brotli`, cùng kết nối mạng:

```powershell
python scripts/vendor-fonts.py
node scripts/build-portable.cjs
```

Sau khi cập nhật, chạy kiểm tra trình duyệt để xác nhận font tải được khi offline và hiển thị ký tự tiếng Việt đúng. Script tải lại có thể cập nhật font nếu nguồn upstream đã thay đổi; manifest ghi lại checksum của lần tải đó.
