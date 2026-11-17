import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Pagecraft</h1>
        <p className="mt-2 text-slate-600">Drag-and-drop landing page builder.</p>
        <Link className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white" href="/editor">
          Open editor
        </Link>
      </div>
    </main>
  );
}
