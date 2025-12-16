# QC Dashboard

QC 대시보드 웹 애플리케이션

## 🚀 배포 방법

### 방법 1: Vercel 배포 (추천 - 가장 쉬움)

#### 옵션 A: v0에서 직접 배포
1. v0 우측 상단 **"Publish"** 버튼 클릭
2. GitHub 계정 연결
3. 자동 배포 완료 → URL 받기
4. Apps Script의 `WEBAPP_URL`에 배포된 URL 입력

#### 옵션 B: 수동 배포
1. **GitHub에 코드 업로드**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Vercel에 배포**
   - [vercel.com](https://vercel.com) 접속
   - "New Project" 클릭
   - GitHub 저장소 선택
   - 자동 감지됨 (Next.js)
   - "Deploy" 클릭
   - 배포 완료 후 URL 받기

3. **Apps Script 설정**
   - 배포된 URL을 `WEBAPP_URL`에 입력
   - 예: `https://qc-dashboard.vercel.app/api/sync`

### 방법 2: 로컬 실행 (테스트용)

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 브라우저에서 http://localhost:3000 접속
```

### 방법 3: 다른 호스팅 서비스

#### Netlify
- GitHub 저장소 연결
- 빌드 명령: `pnpm build`
- 출력 디렉토리: `.next`

#### Railway
- GitHub 저장소 연결
- 자동 감지

#### Render
- GitHub 저장소 연결
- 빌드 명령: `pnpm build`
- 시작 명령: `pnpm start`

## 📋 필수 설정

### Apps Script 연동
배포 후 받은 URL을 Apps Script 코드에 입력:
```javascript
const WEBAPP_URL = "https://your-app.vercel.app/api/sync";
```

## 🛠️ 개발

```bash
# 개발 서버
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

## 📁 프로젝트 구조

```
├── app/              # Next.js App Router
├── components/       # React 컴포넌트
├── lib/             # 유틸리티 및 타입
└── public/          # 정적 파일
```

