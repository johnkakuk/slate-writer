import React, { useMemo } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import Column from './Column.jsx';
import CardContextMenu from './CardContextMenu.jsx';
import DeleteConfirmPopover from './DeleteConfirmPopover.jsx';
import ActContextMenu from './ActContextMenu.jsx';
import ActDeleteConfirmPopover from './ActDeleteConfirmPopover.jsx';

export default function OutlineBoard() {
  const { project, addAct } = useProject();

  // Scene numbers are derived from current position (all acts, in order)
  // rather than stored on the card, so they stay correct as cards are
  // added, removed, or dragged into a new order.
  const sceneNumbers = useMemo(() => {
    const map = new Map();
    let n = 1;
    for (const act of project.acts) {
      for (const card of act.cards) {
        map.set(card.id, n++);
      }
    }
    return map;
  }, [project.acts]);

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <div className="board-title">Outline</div>
          <div className="board-sub">Drag cards to reorder or move between acts</div>
        </div>
      </div>

      <div className="board-columns">
        {project.acts.map((act) => (
          <Column key={act.id} act={act} sceneNumbers={sceneNumbers} />
        ))}
        <button className="board-add-col" onClick={addAct}>
          + add act
        </button>
      </div>
      <CardContextMenu />
      <DeleteConfirmPopover />
      <ActContextMenu />
      <ActDeleteConfirmPopover />
    </div>
  );
}
