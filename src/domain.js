export function makeDomainJson({ meta, walls, items, annotations }) {
  return {
    schemaVersion: "1.0.0",
    meta: {
      projectId: meta.projectId,
      name: meta.name,
      unit: "mm",
      createdAt: meta.createdAt,
      updatedAt: new Date().toISOString()
    },
    viewport: {
      origin: { x: 0, y: 0 },
      scale: meta.scale ?? 1,
      grid: { enabled: true, size: 50 }
    },
    stories: [
      {
        id: "S1",
        name: "1F",
        elements: [
          ...walls.map(w => ({
            id: w.id,
            type: "wall",
            a: { x: w.a.x, y: w.a.y },
            b: { x: w.b.x, y: w.b.y },
            thickness: w.thickness,
            height: 2400
          })),
          ...items.map(it => ({
            id: it.id,
            type: "item",
            catalogRef: it.catalogRef,
            transform: {
              x: it.x,
              y: it.y,
              rotation: it.rotation ?? 0,
              scaleX: it.scaleX ?? 1,
              scaleY: it.scaleY ?? 1
            },
            snap: it.snap ?? null,
            props: it.props ?? {}
          }))
        ],
        x_annotations: annotations ?? []
      }
    ]
  };
}

export function parseDomainJson(json) {
  const story = json?.stories?.[0];
  if (!story) throw new Error("Invalid domain json: stories[0] missing");
  const walls = [];
  const items = [];
  for (const el of story.elements || []) {
    if (el.type === "wall") {
      walls.push({
        id: el.id,
        a: { x: el.a.x, y: el.a.y },
        b: { x: el.b.x, y: el.b.y },
        thickness: el.thickness ?? 12
      });
    } else if (el.type === "item") {
      items.push({
        id: el.id,
        catalogRef: el.catalogRef,
        x: el.transform?.x ?? 0,
        y: el.transform?.y ?? 0,
        rotation: el.transform?.rotation ?? 0,
        scaleX: el.transform?.scaleX ?? 1,
        scaleY: el.transform?.scaleY ?? 1,
        snap: el.snap ?? null,
        props: el.props ?? {}
      });
    }
  }
  return {
    walls,
    items,
    annotations: story.x_annotations ?? [],
    meta: {
      name: json?.meta?.name ?? "Imported",
      projectId: json?.meta?.projectId ?? "IMPORTED",
      createdAt: json?.meta?.createdAt ?? new Date().toISOString()
    }
  };
}
