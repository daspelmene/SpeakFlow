import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

export type VocabularyHint = {
  word: string;
  meaning: string;
};

type VocabularyHintsProps = {
  hints: VocabularyHint[];
};

export default function VocabularyHints({ hints }: VocabularyHintsProps) {
  return (
    <Card className="p-6">
      <Badge variant="success">Vocabulary hints</Badge>

      <h2 className="mt-4 text-2xl font-black text-slate-950">
        Useful words and phrases
      </h2>

      <p className="mt-2 text-base leading-7 text-slate-600">
        Try to use these hints during the conversation when they fit naturally.
      </p>

      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-2">
        {hints.map((item) => (
          <div
            key={item.word}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-lg font-black text-slate-950">{item.word}</p>

            <p className="mt-1 text-base leading-7 text-slate-600">
              {item.meaning}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
