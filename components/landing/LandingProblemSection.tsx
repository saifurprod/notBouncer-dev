// LandingProblemSection — explains the problem in two paragraphs.
// Eyebrow + h2 spanning ~8 cols, then a 2-column body grid on tablet/desktop.

export function LandingProblemSection() {
  return (
    <section className="border-t border-stone-100/80 px-6 py-20 sm:px-8 sm:py-24 lg:py-24">
      <div className="mx-auto max-w-[1136px]">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.08em] text-plum-deep">
          The problem
        </p>

        <h2 className="mb-10 max-w-[720px] text-[28px] font-light leading-[1.2] tracking-[-0.02em] text-ink-900 sm:text-[32px] lg:text-[36px] lg:leading-[1.15]">
          Notetakers join your meetings uninvited and record everything.
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 lg:gap-14">
          <p className="text-[15px] leading-[1.65] text-ink-700 sm:text-[16px] sm:leading-[1.6]">
            An attendee opens Otter, or Fireflies, or Read.ai before joining
            your call. A bot enters with them. It listens to every word,
            transcribes the room, and stores the transcript on a server you
            do not control.
          </p>
          <p className="text-[15px] leading-[1.65] text-ink-700 sm:text-[16px] sm:leading-[1.6]">
            You did not consent. Most of the time you do not notice. By the
            time you spot the bot in the participant list, the recording is
            already happening. Zoom gives you no fast way to stop it.
          </p>
        </div>
      </div>
    </section>
  );
}
