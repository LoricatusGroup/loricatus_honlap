import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CatalogEntry, EditableField, LayoutState, LayoutStructure } from '../lib/types'

interface Props {
  structure: LayoutStructure
  state: LayoutState
  fields: EditableField[]
  catalog: CatalogEntry[]
  onChange: (next: LayoutState) => void
  onAddItem: (listName: string) => void
  onDeleteItem: (listName: string, itemId: string) => void
  onAddSection: (template: string) => void
  onRemoveSection: (id: string) => void
}

// Item-label priority by list type — first matching field's value is the label
const LABEL_SUFFIXES: Record<string, string[]> = {
  services: ['title'],
  'about-values': ['title'],
  equipment: ['title'],
  portfolio: ['category', 'title'],
  partners: ['link', 'image'],
  testimonials: ['author', 'quote'],
  'nav-menu': [],
}

// Lists whose child elements' data-edit keys don't follow the templateId-suffix
// prefix convention, so cloneListItem can't produce a clean unique new item.
// Reorder + hide are still fine on these lists.
const NON_ADDABLE_LISTS = new Set(['nav-menu'])

// For nav-menu items, use the data-edit text directly as the row label
// (the field key is "nav-menu-services", not "nav-1-..." — no prefix match).
function navMenuLabel(itemId: string, fields: EditableField[]): string | null {
  const navKeys = ['services', 'about', 'equipment', 'portfolio', 'contact']
  const idx = parseInt(itemId.replace(/^\D+/, ''), 10) - 1
  const key = navKeys[idx]
  if (!key) return null
  const f = fields.find((field) => field.key === `nav-menu-${key}`)
  return f?.value ?? null
}

function labelForItem(
  listName: string,
  itemId: string,
  fields: EditableField[],
  fallbackLabels: Record<string, string>,
): string {
  if (listName === 'nav-menu') {
    const navLabel = navMenuLabel(itemId, fields)
    if (navLabel) return navLabel
  }
  if (fallbackLabels[itemId]) return fallbackLabels[itemId]
  const suffixes = LABEL_SUFFIXES[listName] ?? ['title']
  for (const suf of suffixes) {
    const f = fields.find((field) => field.key === `${itemId}-${suf}`)
    if (f?.value) return f.value.slice(0, 60)
  }
  const any = fields.find((field) => field.key.startsWith(itemId + '-') && field.value)
  return any?.value?.slice(0, 60) || itemId
}

export default function LayoutEditor({
  structure,
  state,
  fields,
  catalog,
  onChange,
  onAddItem,
  onDeleteItem,
  onAddSection,
  onRemoveSection,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Added catalog sections (asec-*): id → catalog entry, for labels + removal.
  const addedById = new Map(state.added_sections.map((a) => [a.id, a]))
  const catalogLabel = (template: string) =>
    catalog.find((c) => c.template === template)?.label ?? 'Szekció'

  const setSectionOrder = (next: string[]) => onChange({ ...state, section_order: next })
  const setListOrder = (listName: string, next: string[]) =>
    onChange({ ...state, list_order: { ...state.list_order, [listName]: next } })
  const setSectionHidden = (name: string, hidden: boolean) =>
    onChange({ ...state, section_hidden: { ...state.section_hidden, [name]: hidden } })
  const setItemHidden = (itemId: string, hidden: boolean) =>
    onChange({ ...state, item_hidden: { ...state.item_hidden, [itemId]: hidden } })

  const sectionLabels = new Map(structure.sections.map((s) => [s.name, s.label]))
  const lists = new Map(structure.lists.map((l) => [l.name, l]))

  // Section drag
  const onSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = state.section_order.indexOf(String(active.id))
    const newIdx = state.section_order.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    setSectionOrder(arrayMove(state.section_order, oldIdx, newIdx))
  }

  const onItemsDragEnd = (listName: string) => (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const order = state.list_order[listName] ?? []
    const oldIdx = order.indexOf(String(active.id))
    const newIdx = order.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    setListOrder(listName, arrayMove(order, oldIdx, newIdx))
  }

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <section className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-1">Szekciók</h2>
        <p className="text-xs text-gray-400 mb-4">
          Húzd a fogantyúkat ☰ a sorrend változtatásához. Pipa kapcsoló a láthatóságra.
          A navigáció és footer fix.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
          <SortableContext items={state.section_order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {state.section_order.map((name) => {
                const added = addedById.get(name)
                return (
                  <SortableRow
                    key={name}
                    id={name}
                    label={added ? catalogLabel(added.template) : sectionLabels.get(name) ?? name}
                    hidden={!!state.section_hidden[name]}
                    onToggleHidden={(h) => setSectionHidden(name, h)}
                    onDelete={added ? () => onRemoveSection(name) : undefined}
                    addedBadge={!!added}
                    large
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {catalog.length > 0 && (
          <div className="mt-5 border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-400 mb-2">➕ Új szekció beszúrása a könyvtárból:</p>
            <div className="flex flex-wrap gap-2">
              {catalog.map((c) => (
                <button
                  key={c.template}
                  type="button"
                  title={c.description}
                  onClick={() => onAddSection(c.template)}
                  className="px-3 py-2 text-sm bg-blue-700 hover:bg-blue-600 rounded text-white font-medium"
                >
                  ➕ {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {structure.lists.map((list) => {
        const order = state.list_order[list.name] ?? list.itemIds
        const originalIds = new Set(list.itemIds)
        return (
          <section key={list.name} className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-1">{list.label}</h2>
            <p className="text-xs text-gray-400 mb-4">
              {order.length} elem · sorrend, láthatóság, hozzáadás, törlés
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onItemsDragEnd(list.name)}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {order.map((itemId) => {
                    const isOriginal = originalIds.has(itemId)
                    const label = labelForItem(list.name, itemId, fields, lists.get(list.name)?.itemLabels ?? {})
                    return (
                      <SortableRow
                        key={itemId}
                        id={itemId}
                        label={label}
                        hidden={!!state.item_hidden[itemId]}
                        onToggleHidden={isOriginal ? (h) => setItemHidden(itemId, h) : undefined}
                        onDelete={
                          isOriginal
                            ? undefined
                            : () => {
                                if (
                                  window.confirm(
                                    `Biztos törlöd a "${label}" kártyát? A változtatás csak mentés után végleges.`,
                                  )
                                ) {
                                  onDeleteItem(list.name, itemId)
                                }
                              }
                        }
                        addedBadge={!isOriginal}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {!NON_ADDABLE_LISTS.has(list.name) && (
              <button
                type="button"
                onClick={() => onAddItem(list.name)}
                className="mt-3 px-3 py-2 text-sm bg-blue-700 hover:bg-blue-600 rounded text-white font-medium"
              >
                + Új {list.label.toLowerCase()} hozzáadása
              </button>
            )}
          </section>
        )
      })}
    </main>
  )
}

interface SortableRowProps {
  id: string
  label: string
  hidden: boolean
  onToggleHidden?: (hidden: boolean) => void
  onDelete?: () => void
  addedBadge?: boolean
  large?: boolean
}

function SortableRow({
  id,
  label,
  hidden,
  onToggleHidden,
  onDelete,
  addedBadge,
  large,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : hidden ? 0.45 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-gray-700 rounded px-3 ${
        large ? 'py-3' : 'py-2'
      } ${hidden ? 'line-through text-gray-400' : 'text-white'}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white px-1 -ml-1"
        aria-label="Áthelyezés"
        type="button"
      >
        ☰
      </button>
      <span className="flex-1 truncate">
        {label}
        {addedBadge && (
          <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-900 text-blue-200 rounded">új</span>
        )}
      </span>
      {onToggleHidden && (
        <label className="text-xs text-gray-300 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!hidden}
            onChange={(e) => onToggleHidden(!e.target.checked)}
            className="accent-blue-500"
          />
          Látható
        </label>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 px-2 py-1 text-sm"
          title="Törlés"
        >
          🗑
        </button>
      )}
    </div>
  )
}
