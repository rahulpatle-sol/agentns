import { Link } from "react-router-dom";

import { PageHeader } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";

/** Shown for any route the router does not recognise. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="Page not found" />
      <Card>
        <EmptyState
          icon="◌"
          title="That route does not exist"
          action={
            <Link to="/" className="btn btn--primary btn--md">
              Back to overview
            </Link>
          }
        >
          The link may be out of date, or the record address in it may have been
          mistyped.
        </EmptyState>
      </Card>
    </>
  );
}
