import { useState } from "react";
import { play } from "@/audio.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useGame } from "@/game/store.tsx";
import { PlayerPortrait, Portrait } from "@/visual/Portrait.tsx";

export function TitleScreen() {
  const { state, dispatch } = useGame();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"m" | "f">("m");
  const [drop, setDrop] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col justify-between px-5 py-6">
      <div>
        <p className="text-xs tracking-[0.28em] text-gold/80">미르시티 · 칼로스 제국</p>
        <h1 className="mt-2 font-display text-5xl text-gold">금제의 거리</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          황제는 배틀을 금하고 포켓몬을 내쫓는다. 반란군은 포켓몬과 함께 경비를 뚫으려 한다.
        </p>
      </div>
      <div className="my-4 flex items-end justify-center gap-4">
        <PlayerPortrait gender="f" size={72} />
        <Portrait speciesId={718} form="zygarde-10" size={88} />
        <PlayerPortrait gender="m" size={72} />
      </div>
      <div className="grid gap-2">
        {state.accounts.map((account) => (
          <div key={account.id} className="flex items-center gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => {
                play("ui");
                dispatch({ type: "pick", id: account.id });
              }}
            >
              {account.name} · {account.gender === "m" ? "남자" : "여자"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDrop(account.id)}>
              삭제
            </Button>
          </div>
        ))}
        <Button
          size="lg"
          onClick={() => {
            play("ui");
            setMaking(true);
          }}
        >
          새 계정
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          포켓몬은 Nintendo / Game Freak / Creatures의 상표다. 도트는 공식 그림이 아니다.
        </p>
      </div>
      <Dialog open={making} onOpenChange={setMaking} title="새 계정" description="미르시티에 들어올 이름과 모습.">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            play("ui");
            dispatch({ type: "create", name, gender });
            setMaking(false);
          }}
        >
          <Input aria-label="이름" maxLength={8} value={name} placeholder="이름" onChange={(event) => setName(event.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={gender === "m" ? "default" : "secondary"} onClick={() => setGender("m")}>
              남자
            </Button>
            <Button type="button" variant={gender === "f" ? "default" : "secondary"} onClick={() => setGender("f")}>
              여자
            </Button>
          </div>
          <Button type="submit">반란군에 든다</Button>
        </form>
      </Dialog>
      <Dialog open={drop !== null} onOpenChange={(open) => !open && setDrop(null)} title="계정을 지울까?" description="이 브라우저에 남은 그 계정의 기록만 지운다.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDrop(null)}>
            돌아가기
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!drop) return;
              dispatch({ type: "delete-account", id: drop });
              setDrop(null);
            }}
          >
            삭제
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
