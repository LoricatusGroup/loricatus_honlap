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
import type { LayoutState, LayoutStructure } from '../lib/types'

interface Props {
  structure: LayoutStructure
  state: LayoutState
  onChange: (next: LayoutState) => void
}

export default function LayoutEditor({ structure, state, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const setSectionOrder = (next: string[]) => onChange({ ...state, section_order: next })
  const setListOrder = (listName: string, next: string[]) =>
    onChange({ ...state, list_order: { ...state.list_order, [listName]: next } })
  const setSectionHidden = (name: string, hidden: boolean) =>
    onChange({ ...state, section_hidden: { ...state.section_hidden, [name]: hidden } })
  const setItemHidden = (itemId: string, hidden: boolean) =>
    onChange({ ...state, item_hidden: { ...state.item_hidden, [itemId]: hidden } })

  // Map for quick label lookups
  const sectionLabels = new Map(structure.sections.map((s) => [s.name, s.label]))
  const lists = new Map(structure.lists.map((l) => [l.name, l]))

  // Section drag-end
  const onSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = state.section_order.indexOf(String(active.id))
    const newIdx = state.section_order.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    setSectionOrder(arrayMove(state.section_order, oldIdx, newIdx))
  }

  // Items drag-end (per-list)
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
              {state.section_order.map((name) => (
                <SortableRow
                  key={name}
                  id={name}
                  label={sectionLabels.get(name) ?? name}
                  hidden={!!state.section_hidden[name]}
                  onToggleHidden={(h) => setSectionHidden(name, h)}
                  large
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {structure.lists.map((list) => {
        const order = state.list_order[list.name] ?? list.itemIds
        return (
          <section key={list.name} className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-1">{list.label}</h2>
            <p className="text-xs text-gray-400 mb-4">
              {order.length} elem · sorrend és láthatóság
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onItemsDragEnd(list.name)}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {order.map((itemId) => (
                    <SortableRow
                      key={itemId}
                      id={itemId}
                      label={lists.get(list.name)?.itemLabels[itemId] ?? itemId}
                      hidden={!!state.item_hidden[itemId]}
                      onToggleHidden={(h) => setItemHidden(itemId, h)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
  onToggleHidden: (hidden: boolean) => void
  large?: boolean
}

function SortableRow({ id, label, hidden, onToggleHidden, large }: SortableRowProps) {
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
      <span className="flex-1 truncate">{label}</span>
      <label className="text-xs text-gray-300 flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!hidden}
          onChange={(e) => onToggleHidden(!e.target.checked)}
          className="accent-blue-500"
        />
        Látható
      </label>
    </div>
  )
}
