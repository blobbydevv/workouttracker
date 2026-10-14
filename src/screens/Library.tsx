import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Confirm, Header, Loading } from "../components/ui";
import { db, uid } from "../db/db";

export default function Library() {
  const nav = useNavigate();
  const [del, setDel] = useState<string | null>(null);
  const templates = useLiveQuery(() => db.templates.filter((t) => t.inLibrary).toArray(), []);
  if (!templates) return <Loading />;
  return (
    <div className="screen">
      <Header
        title="Workout Library"
        back="/workout"
        right={
          <button
            className="icon-btn"
            aria-label="New workout"
            onClick={async () => {
              const id = uid();
              await db.templates.add({ id, name: "New Workout", items: [], inLibrary: true, createdAt: Date.now() });
              nav(`/workout/template/${id}`);
            }}
          >
            <Icon name="plus" />
          </button>
        }
      />
      {templates.length === 0 ? (
        <div className="empty">
          <p>Your library is empty.</p>
          <p className="faint">Workouts you remove from your schedule with “Save to Workout Library” appear here, ready to add back.</p>
        </div>
      ) : (
        <div className="card list">
          {templates.map((t) => (
            <div key={t.id} className="list-item">
              <Link to={`/workout/template/${t.id}`} className="grow" style={{ color: "inherit", textDecoration: "none" }}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="faint">{t.items.length} exercises</div>
              </Link>
              <button className="icon-btn" aria-label={`Remove ${t.name} from library`} onClick={() => setDel(t.id)}><Icon name="trash" /></button>
            </div>
          ))}
        </div>
      )}
      <Confirm
        open={!!del}
        title="Remove from library?"
        body="Workouts already scheduled or in your history are kept."
        confirmLabel="Remove"
        danger
        onClose={() => setDel(null)}
        onConfirm={() => db.templates.update(del!, { inLibrary: false })}
      />
    </div>
  );
}
