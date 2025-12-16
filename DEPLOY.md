# 배포 가이드

## 🎯 빠른 배포 (3단계)

### 1단계: GitHub에 코드 업로드

#### 방법 A: GitHub 웹에서
1. [github.com](https://github.com) 접속
2. "New repository" 클릭
3. 저장소 이름 입력 (예: `qc-dashboard`)
4. "Create repository" 클릭
5. 업로드 방법 선택:
   - **옵션 1**: "uploading an existing file" 클릭 → 파일 드래그 앤 드롭
   - **옵션 2**: 아래 명령어 사용

#### 방법 B: 터미널에서
```bash
cd /Users/may.08/Desktop/kmcc_qc_dashbord

# Git 초기화 (아직 안 했다면)
git init
git add .
git commit -m "Initial commit"

# GitHub 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/qc-dashboard.git
git branch -M main
git push -u origin main
```

### 2단계: Vercel 배포

1. **[vercel.com](https://vercel.com) 접속**
2. **GitHub로 로그인**
3. **"Add New..." → "Project" 클릭**
4. **방금 만든 GitHub 저장소 선택**
5. **설정 확인:**
   - Framework Preset: Next.js (자동 감지)
   - Build Command: `pnpm build` (자동)
   - Output Directory: `.next` (자동)
   - Install Command: `pnpm install` (자동)
6. **"Deploy" 클릭**
7. **배포 완료 대기 (약 1-2분)**
8. **배포된 URL 복사** (예: `https://qc-dashboard-xxx.vercel.app`)

### 3단계: Apps Script 설정

1. **Google Sheets 열기**
2. **확장 프로그램 → Apps Script**
3. **`WEBAPP_URL` 수정:**
   ```javascript
   const WEBAPP_URL = "https://qc-dashboard-xxx.vercel.app/api/sync";
   ```
4. **저장 후 "지금 동기화" 메뉴 실행**

## ✅ 완료!

이제 구글 시트 ↔ 웹앱이 자동으로 동기화됩니다.

---

## 🔄 업데이트 방법

코드를 수정한 후:

```bash
git add .
git commit -m "Update dashboard"
git push
```

Vercel이 자동으로 재배포합니다! (약 1-2분 소요)

---

## 🌐 다른 배포 옵션

### Netlify
1. [netlify.com](https://netlify.com) 접속
2. GitHub 저장소 연결
3. 빌드 설정:
   - Build command: `pnpm build`
   - Publish directory: `.next`
4. Deploy

### Railway
1. [railway.app](https://railway.app) 접속
2. GitHub 저장소 연결
3. 자동 감지 및 배포

### Render
1. [render.com](https://render.com) 접속
2. GitHub 저장소 연결
3. Web Service 선택
4. 빌드 명령: `pnpm build`
5. 시작 명령: `pnpm start`

---

## 🐛 문제 해결

### 빌드 에러
- `pnpm install` 로컬에서 실행해서 에러 확인
- TypeScript 에러는 `next.config.mjs`에서 무시 설정됨

### CORS 에러
- Vercel은 자동으로 CORS 처리
- 다른 호스팅 사용 시 CORS 설정 필요

### Apps Script 연결 안 됨
- 웹앱 URL이 정확한지 확인
- `/api/sync` 경로 포함 확인
- Vercel 배포 완료 후 최소 1분 대기

