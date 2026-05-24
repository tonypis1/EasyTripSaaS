export function SectionContainer(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mx-auto max-w-6xl px-4 py-14 sm:py-20 ${
        props.className ?? ""
      }`}
    >
      {props.children}
    </section>
  );
}
