# Konva Floorplan Advanced (React + react-konva)

**Konva.js + floorplan.domain.json** 조합을 실무에 가까운 형태로 확장한 샘플입니다.

## 포함 기능
- Wall 도구: 캔버스에 드래그로 벽(Line) 생성
- 카탈로그 Drag & Drop: 좌측 아이템을 캔버스로 드래그해서 배치
- **벽 스냅**: 문/싱크대는 벽 근처에 놓으면 자동으로 가장 가까운 벽에 스냅
- **회전/리사이즈 핸들**: 선택한 아이템에 Transformer 표시
- **Undo/Redo**: 버튼 + 단축키 지원 (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- Export/Import: `floorplan.domain.json` 다운로드/업로드로 복원
- Export: PNG / PDF (Konva → 이미지 → PDF)

## 실행 방법
```bash
npm install
npm run dev
```
브라우저:
- http://localhost:5174
