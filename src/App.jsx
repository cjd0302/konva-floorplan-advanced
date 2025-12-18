import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Stage, Layer, Line, Rect, Text, Group, Transformer } from 'react-konva'
import { makeDomainJson, parseDomainJson } from './domain.js'
import { uid, downloadJson, readJsonFile, clamp } from './utils.js'
import { createHistory, push, undo, redo, canUndo, canRedo } from './history.js'
import { snapItemToWalls } from './snap.js'
import { exportPng, exportPdf } from './exporters.js'

const CANVAS_W = 1400
const CANVAS_H = 900

const CATALOG = [
  { catalogRef: 'door.single.900', name: '여닫이문 900', category: 'Door', snapRules: ['wall'] },
  { catalogRef: 'kitchen.sink.1200', name: '싱크대 1200', category: 'Kitchen', snapRules: ['wall'] },
  { catalogRef: 'furniture.sofa.1800', name: '소파 1800', category: 'Furniture', snapRules: [] }
]

function isDoor(ref) {
  return ref?.startsWith('door.')
}

export default function App() {
  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const trRef = useRef(null)

  const [tool, setTool] = useState('select') // select | wall
  const [scale, setScale] = useState(1)

  const [walls, setWalls] = useState([])
  const [items, setItems] = useState([])
  const [annotations, setAnnotations] = useState([])

  const [draftWall, setDraftWall] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  // ✅ Pointer 기반 Drag(삼성브라우저 대응)
  const [dragCat, setDragCat] = useState(null) // CATALOG에서 집은 항목
  const [ghost, setGhost] = useState({ x: -9999, y: -9999 })

  const [history, setHistory] = useState(() => {
    const h = createHistory(80)
    return push(h, snapshot({ walls: [], items: [], annotations: [] }))
  })

  const meta = useMemo(
    () => ({
      projectId: 'P-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-0001',
      name: 'Konva Floorplan Advanced',
      createdAt: new Date().toISOString(),
      scale
    }),
    [scale]
  )

  // ===== Utils =====
  const commit = useCallback(
    (nextWalls, nextItems, nextAnn = annotations) => {
      setWalls(nextWalls)
      setItems(nextItems)
      setAnnotations(nextAnn)
      setHistory((h) => push(h, snapshot({ walls: nextWalls, items: nextItems, annotations: nextAnn })))
    },
    [annotations]
  )

  const toStagePoint = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    if (!pos) return { x: 0, y: 0 }
    // scale은 Stage scaleX/scaleY로 반영되므로, pointerPosition은 화면좌표.
    // 기존 로직 유지: 스케일로 나눠서 도면 좌표화.
    return { x: pos.x / scale, y: pos.y / scale }
  }, [scale])

  // screen(client) 좌표 -> stage 좌표(스케일/패닝 포함) 변환
  const screenToStagePoint = useCallback((clientX, clientY) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }

    const rect = stage.container().getBoundingClientRect()
    const pointer = { x: clientX - rect.left, y: clientY - rect.top }

    // stage의 transform(스케일/패닝) 반영
    const tr = stage.getAbsoluteTransform().copy()
    tr.invert()
    return tr.point(pointer)
  }, [])

  // ===== Transformer attach =====
  useEffect(() => {
    const stage = stageRef.current
    const tr = trRef.current
    if (!stage || !tr) return

    if (!selectedId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }

    const node = stage.findOne('#' + selectedId)
    if (node) {
      tr.nodes([node])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [selectedId, walls, items])

  // ===== Undo/Redo =====
  const doUndo = useCallback(() => {
    setHistory((h) => {
      const nh = undo(h)
      if (nh !== h && nh.present) {
        const s = nh.present
        setWalls(s.walls)
        setItems(s.items)
        setAnnotations(s.annotations || [])
        setSelectedId(null)
      }
      return nh
    })
  }, [])

  const doRedo = useCallback(() => {
    setHistory((h) => {
      const nh = redo(h)
      if (nh !== h && nh.present) {
        const s = nh.present
        setWalls(s.walls)
        setItems(s.items)
        setAnnotations(s.annotations || [])
        setSelectedId(null)
      }
      return nh
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrl = isMac ? e.metaKey : e.ctrlKey
      if (!ctrl) return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        doUndo()
      } else if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        doRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doUndo, doRedo])

  // ===== Pointer Drag from Sidebar -> Canvas (Samsung Browser OK) =====
  useEffect(() => {
    if (!dragCat) return

    const onMove = (e) => {
      setGhost({ x: e.clientX + 10, y: e.clientY + 10 })
    }

    const onUp = (e) => {
      const host = containerRef.current
      const stage = stageRef.current
      if (!host || !stage) {
        setDragCat(null)
        setGhost({ x: -9999, y: -9999 })
        return
      }

      const r = host.getBoundingClientRect()
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom

      if (inside) {
        const p = screenToStagePoint(e.clientX, e.clientY)

        let next = {
          id: uid('I'),
          catalogRef: dragCat.catalogRef,
          x: p.x,
          y: p.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          snap: null,
          props: {}
        }

        if (dragCat.snapRules?.includes('wall')) {
          const s = snapItemToWalls({ x: p.x, y: p.y }, walls, 45)
          if (s) {
            next = {
              ...next,
              x: s.point.x,
              y: s.point.y,
              rotation: isDoor(next.catalogRef) ? s.rotation : next.rotation,
              snap: s.snap
            }
          }
        }

        commit(walls, [...items, next])
      }

      setDragCat(null)
      setGhost({ x: -9999, y: -9999 })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragCat, screenToStagePoint, walls, items, commit])

  // ===== Drawing / Interaction =====
  const onPointerDown = useCallback(
    (e) => {
      const stage = e.target.getStage()
      if (!stage) return
      if (e.target === stage) setSelectedId(null)

      if (tool === 'wall') {
        const p = toStagePoint()
        setDraftWall({ a: p, b: p, thickness: 12 })
      }
    },
    [tool, toStagePoint]
  )

  const onPointerMove = useCallback(() => {
    if (tool !== 'wall' || !draftWall) return
    const p = toStagePoint()
    setDraftWall({ ...draftWall, b: p })
  }, [tool, draftWall, toStagePoint])

  const onPointerUp = useCallback(() => {
    if (tool !== 'wall' || !draftWall) return
    const a = draftWall.a
    const b = draftWall.b
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx + dy < 6) {
      setDraftWall(null)
      return
    }
    const w = { id: uid('W'), a, b, thickness: draftWall.thickness }
    commit([...walls, w], items)
    setDraftWall(null)
  }, [tool, draftWall, walls, items, commit])

  const onWheel = useCallback(
    (e) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const scaleBy = 1.05
      const oldScale = scale
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const newScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.3, 3)
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale
      }
      setScale(newScale)
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      }
      stage.position(newPos)
      stage.batchDraw()
    },
    [scale]
  )

  // ===== Export / Import / Utilities =====
  const exportDomain = () => {
    const json = makeDomainJson({ meta, walls, items, annotations })
    downloadJson(json, 'floorplan.domain.json')
  }

  const importDomain = async (file) => {
    const json = await readJsonFile(file)
    const parsed = parseDomainJson(json)
    const stage = stageRef.current
    if (stage) stage.position({ x: 0, y: 0 })
    setScale(1)
    setSelectedId(null)
    setDraftWall(null)
    commit(parsed.walls, parsed.items, parsed.annotations || [])
  }

  const deleteSelected = () => {
    if (!selectedId) return
    commit(
      walls.filter((w) => w.id !== selectedId),
      items.filter((it) => it.id !== selectedId)
    )
    setSelectedId(null)
  }

  const clearAll = () => {
    setSelectedId(null)
    setDraftWall(null)
    commit([], [])
  }

  const exportPNG = () => {
    const stage = stageRef.current
    if (!stage) return
    exportPng(stage, 'floorplan.png', 3)
  }

  const exportPDF = async () => {
    const stage = stageRef.current
    if (!stage) return
    await exportPdf(stage, 'floorplan.pdf', 3)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>컴포넌트</strong>
            <span className="pill">Drag & Drop</span>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            문/싱크대는 벽 근처에 놓으면 <b>자동 스냅</b>됩니다.
            <br />
            Undo: <span className="kbd">Ctrl/Cmd+Z</span> / Redo:{' '}
            <span className="kbd">Ctrl/Cmd+Shift+Z</span>
          </div>
        </div>

        <div className="card">
          {CATALOG.map((it) => (
            <div
              key={it.catalogRef}
              className="item"
              onPointerDown={(e) => {
                e.preventDefault()
                setDragCat(it)
                setGhost({ x: e.clientX + 10, y: e.clientY + 10 })
              }}
              title="누르고 이동해서 캔버스에 놓기"
            >
              <div>
                <strong>{it.name}</strong>
                <br />
                <small>{it.catalogRef}</small>
              </div>
              <span className="pill">{it.category}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <strong>도면 JSON 미리보기</strong>
          <div className="hint" style={{ marginTop: 8 }}>
            Export로 <code>floorplan.domain.json</code> 저장 후 Import로 복원합니다.
          </div>
          <pre style={{ marginTop: 10 }}>
            {JSON.stringify(
              makeDomainJson({ meta, walls, items, annotations }).stories[0].elements.slice(0, 6),
              null,
              2
            )}
          </pre>
        </div>
      </aside>

      <main className="canvasWrap">
        <div className="toolbar">
          <button className={'btn ' + (tool === 'select' ? 'primary' : '')} onClick={() => setTool('select')}>
            Select / Pan
          </button>
          <button className={'btn ' + (tool === 'wall' ? 'primary' : '')} onClick={() => setTool('wall')}>
            Wall
          </button>
          <span className="pill">Zoom: {Math.round(scale * 100)}%</span>

          <button className="btn" onClick={doUndo} disabled={!canUndo(history)}>
            Undo
          </button>
          <button className="btn" onClick={doRedo} disabled={!canRedo(history)}>
            Redo
          </button>

          <button className="btn" onClick={deleteSelected} disabled={!selectedId}>
            Delete
          </button>
          <button className="btn" onClick={clearAll}>
            Clear
          </button>

          <span style={{ flex: 1 }} />

          <button className="btn primary" onClick={exportDomain}>
            Export domain.json
          </button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Import domain.json
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) await importDomain(f)
                e.target.value = ''
              }}
            />
          </label>

          <button className="btn" onClick={exportPNG}>
            Export PNG
          </button>
          <button className="btn" onClick={exportPDF}>
            Export PDF
          </button>
        </div>

        <div className="stageHost" ref={containerRef}>
          <Stage
            ref={stageRef}
            width={containerRef.current?.clientWidth ?? CANVAS_W}
            height={containerRef.current?.clientHeight ?? CANVAS_H}
            draggable={tool === 'select'}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            onWheel={onWheel}
            style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e8ee' }}
          >
            <Layer listening={false} id="gridLayer">
              <Grid width={2400} height={2400} size={50} />
            </Layer>

            <Layer id="wallsLayer">
              {walls.map((w) => (
                <Line
                  key={w.id}
                  id={w.id}
                  points={[w.a.x, w.a.y, w.b.x, w.b.y]}
                  stroke={selectedId === w.id ? '#2563eb' : '#111827'}
                  strokeWidth={w.thickness}
                  lineCap="round"
                  onClick={() => setSelectedId(w.id)}
                  onTap={() => setSelectedId(w.id)}
                />
              ))}
              {draftWall && (
                <Line
                  points={[draftWall.a.x, draftWall.a.y, draftWall.b.x, draftWall.b.y]}
                  stroke="#9ca3af"
                  strokeWidth={draftWall.thickness}
                  dash={[10, 10]}
                  lineCap="round"
                  listening={false}
                />
              )}
            </Layer>

            <Layer id="itemsLayer">
              {items.map((it) => (
                <ItemNode
                  key={it.id}
                  item={it}
                  selected={selectedId === it.id}
                  onSelect={() => setSelectedId(it.id)}
                  onCommit={(next) => {
                    const nextItems = items.map((p) => (p.id === it.id ? next : p))
                    commit(walls, nextItems)
                  }}
                  walls={walls}
                />
              ))}

              <Transformer
                ref={trRef}
                rotateEnabled={true}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 30 || newBox.height < 20) return oldBox
                  return newBox
                }}
              />
            </Layer>
          </Stage>
        </div>
      </main>

      {/* Drag Ghost */}
      {dragCat && (
        <div className="dragGhost" style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }}>
          {dragCat.name}
        </div>
      )}
    </div>
  )
}

function snapshot({ walls, items, annotations }) {
  return {
    walls: walls.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } })),
    items: items.map((i) => ({
      ...i,
      props: { ...(i.props || {}) },
      snap: i.snap ? { ...i.snap, at: i.snap.at ? { ...i.snap.at } : undefined } : null
    })),
    annotations: (annotations || []).map((a) => ({ ...a }))
  }
}

function Grid({ width, height, size }) {
  const lines = []
  for (let x = 0; x <= width; x += size) lines.push([x, 0, x, height])
  for (let y = 0; y <= height; y += size) lines.push([0, y, width, y])
  return (
    <Group opacity={0.25}>
      {lines.map((p, i) => (
        <Line key={i} points={p} stroke="#e5e7eb" strokeWidth={1} />
      ))}
    </Group>
  )
}

function ItemNode({ item, selected, onSelect, onCommit, walls }) {
  const isSnapTarget = item.catalogRef?.startsWith('door.') || item.catalogRef?.startsWith('kitchen.')
  const label = item.catalogRef.split('.').slice(0, 2).join('.')

  const handleDragEnd = (e) => {
    const nx = e.target.x()
    const ny = e.target.y()
    let next = { ...item, x: nx, y: ny, snap: null }

    if (isSnapTarget) {
      const s = snapItemToWalls({ x: nx, y: ny }, walls, 45)
      if (s) {
        next = {
          ...next,
          x: s.point.x,
          y: s.point.y,
          rotation: item.catalogRef.startsWith('door.') ? s.rotation : next.rotation,
          snap: s.snap
        }
        e.target.position({ x: next.x, y: next.y })
        if (item.catalogRef.startsWith('door.')) e.target.rotation(next.rotation)
      }
    }

    onCommit(next)
  }

  const handleTransformEnd = (e) => {
    const node = e.target
    const next = {
      ...item,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY()
    }
    onCommit(next)
  }

  return (
    <Group
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      scaleX={item.scaleX}
      scaleY={item.scaleY}
      draggable
      name="item"
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={160}
        height={90}
        cornerRadius={10}
        fill={selected ? '#dbeafe' : '#f3f4f6'}
        stroke={selected ? '#2563eb' : '#9ca3af'}
        strokeWidth={2}
      />
      <Text text={label} x={10} y={10} fontSize={14} fill="#111827" />
      <Text text={item.catalogRef} x={10} y={34} fontSize={11} fill="#6b7280" width={140} />
      {item.snap?.to === 'wall' && <Text text={'SNAP'} x={10} y={64} fontSize={11} fill="#2563eb" />}
    </Group>
  )
}
