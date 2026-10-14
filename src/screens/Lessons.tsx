import { Header } from "../components/ui";

/**
 * Lessons are licensed BWS educational content that this repository does not
 * have (content gap). We do not invent lesson text and present it as the
 * original. The lessonProgress table is ready for real content.
 */
export default function Lessons() {
  return (
    <div className="screen">
      <Header title="Lessons" back="/" />
      <div className="empty">
        <p><strong>No lessons available</strong></p>
        <p className="faint">Lesson content must be supplied through authorised access to the Built With Science library. Once provided, lessons will appear here with completion tracking.</p>
      </div>
    </div>
  );
}
