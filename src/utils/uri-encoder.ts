/**
 * RFC 3986 URI 인코딩 (AWS S3 키용)
 *
 * AWS Signature v4 정규 URI 규칙을 준수하는 인코딩 함수입니다.
 *
 * - 슬래시(/)는 경로 구분자로 보존
 * - unreserved 문자 (A-Za-z0-9-_.~)는 유지
 * - 나머지 문자는 퍼센트 인코딩
 *
 * @param key - R2 객체 키 (예: "images/sival.png")
 * @returns RFC 3986 준수 인코딩된 키
 *
 * @example
 * encodeS3Key('sival.png')                    // 'sival.png'
 * encodeS3Key('images/sival.png')             // 'images/sival.png'
 * encodeS3Key('folder/subfolder/file.png')    // 'folder/subfolder/file.png'
 * encodeS3Key('file name.png')                // 'file%20name.png'
 * encodeS3Key('파일.png')                      // '%ED%8C%8C%EC%9D%BC.png'
 */
export function encodeS3Key(key: string): string {
  return key
    .split('')
    .map(char => {
      // 슬래시는 경로 구분자로 유지
      if (char === '/') return char

      // RFC 3986 unreserved 문자는 그대로 유지
      if (/[A-Za-z0-9\-_.~]/.test(char)) return char

      // 나머지는 퍼센트 인코딩
      const code = char.charCodeAt(0)

      // UTF-8 인코딩 (멀티바이트 문자)
      if (code > 0x7F) {
        return encodeURIComponent(char)
      }

      // ASCII 범위 단일 바이트
      return '%' + code.toString(16).toUpperCase().padStart(2, '0')
    })
    .join('')
}
