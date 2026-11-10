/**
 * The examination hall.
 *
 * A sitting is deliberately kept outside the applicant portal's chrome: a
 * candidate under a clock is shown the question, the countdown and the
 * navigator, and nothing that invites them to wander off mid-paper. Each page
 * in this group supplies its own header and `main` landmark.
 */
export default function ExaminationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
