import type { ReactNode } from "react";

export function ActionFeedback({ pending, success }: { pending?: string; success?: ReactNode }) {
  const content = pending || success;
  return <div className="action-feedback" role="status">
    {content && <div className={`action-feedback-body${pending ? " is-pending" : " is-complete"}`}>
      <span key={pending ? "pending" : "success"} className="action-feedback-mark" aria-hidden="true" />
      <div>{content}</div>
    </div>}
  </div>;
}
