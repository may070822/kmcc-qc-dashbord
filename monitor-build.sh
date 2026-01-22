#!/bin/bash

# 빌드 모니터링 스크립트

BUILD_ID=${1:-"3be55435-41c5-494a-90bc-97969111f9ef"}
REGION="asia-northeast3"

echo "=========================================="
echo "빌드 모니터링"
echo "=========================================="
echo "빌드 ID: $BUILD_ID"
echo "리전: $REGION"
echo ""

# 빌드 상태 확인
while true; do
  STATUS=$(gcloud builds describe $BUILD_ID --region=$REGION --format="value(status)" 2>/dev/null)
  
  case $STATUS in
    QUEUED)
      echo "⏸️  빌드 대기 중..."
      sleep 5
      ;;
    WORKING)
      echo -n "⏳ 빌드 진행 중"
      for i in {1..3}; do
        echo -n "."
        sleep 1
      done
      echo ""
      ;;
    SUCCESS)
      echo ""
      echo "✅ 빌드 성공!"
      echo ""
      echo "빌드 로그 URL:"
      gcloud builds describe $BUILD_ID --region=$REGION --format="value(logUrl)" 2>/dev/null
      echo ""
      echo "Cloud Run 서비스 확인:"
      gcloud run services describe qc-dashboard --region=$REGION --format="value(status.url)" 2>/dev/null
      break
      ;;
    FAILURE|CANCELLED|TIMEOUT|INTERNAL_ERROR)
      echo ""
      echo "❌ 빌드 실패: $STATUS"
      echo ""
      echo "에러 로그:"
      gcloud builds log $BUILD_ID --region=$REGION 2>/dev/null | tail -50
      break
      ;;
    *)
      echo "상태: $STATUS"
      sleep 5
      ;;
  esac
  
  sleep 5
done

echo ""
echo "=========================================="
