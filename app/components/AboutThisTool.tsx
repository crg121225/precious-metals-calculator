// Plain-language note on what this tool does and doesn't do, shown on every page.
// Keep it accurate: update this text if the app ever starts sending or storing anything new.

export default function AboutThisTool({ light = false }: { light?: boolean }) {
  const box = light
    ? 'border-slate-300 bg-slate-50 text-slate-600'
    : 'border-slate-800 bg-slate-900/60 text-slate-400';
  const strong = light ? 'text-slate-800' : 'text-slate-200';

  return (
    <aside className={`mx-auto mt-10 max-w-7xl rounded-xl border p-5 text-xs leading-relaxed print:hidden ${box}`}>
      <h2 className={`mb-2 text-sm font-bold ${strong}`}>How this tool works</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <span className={strong}>It&rsquo;s a calculator, not AI.</span> It does the same multiplication you would do
          by hand: weight × purity × spot price, then your margin or premium. There is no artificial intelligence in it.
        </li>
        <li>
          <span className={strong}>You stay in charge of every number.</span> You set the margins and premiums, you can
          type your own price on any line, and nothing is posted or changed unless you do it.
        </li>
        <li>
          <span className={strong}>Your business stays on this device.</span> Customer tickets, premiums, prices and
          showcase photos are never uploaded or sent anywhere. Price sheet settings and showcase cards are saved only in
          this browser on this phone or computer.
        </li>
        <li>
          <span className={strong}>The only thing it looks up online</span> is the public market price of gold,
          silver, platinum and palladium: a tiny request, about once a minute on the calculator, and on the price sheet
          only when you press the button. You can always type the prices in yourself instead.
        </li>
      </ul>
    </aside>
  );
}
