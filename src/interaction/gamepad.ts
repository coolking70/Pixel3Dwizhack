export interface PadSnapshot { connected:boolean; axes:readonly number[]; buttons:readonly {pressed:boolean}[] }
export interface PadKeys { down:(key:string,code:string)=>void; up:(key:string,code:string)=>void }
/** Edges only. Held repetition is owned by the same bounded intent as keyboard input. */
export class GamepadInput {
  private held = new Set<string>();
  private neutralRequired = false;
  constructor(private keys:PadKeys) {}
  cancel() { for(const key of this.held)this.keys.up(key,`Gamepad:${key}`);this.held.clear();this.neutralRequired=true; }
  sample(pad:PadSnapshot|undefined,menu:boolean) {
    const next=new Set<string>();
    if(pad?.connected){
      const pressed=(i:number)=>!!pad.buttons[i]?.pressed;
      const x=pad.axes[0]??0,y=pad.axes[1]??0;
      if(pressed(14)||x<-.55)next.add(menu?'TabBack':'ArrowLeft');
      if(pressed(15)||x>.55)next.add(menu?'Tab':'ArrowRight');
      if(pressed(12)||y<-.55)next.add(menu?'TabBack':'ArrowUp');
      if(pressed(13)||y>.55)next.add(menu?'Tab':'ArrowDown');
      if(pressed(0))next.add('Enter');if(pressed(1))next.add('Escape');
      if(pressed(2))next.add('b');if(pressed(3))next.add(' ');if(pressed(9))next.add('Escape');
    }
    for(const key of this.held)if(!next.has(key))this.keys.up(key,`Gamepad:${key}`);
    if(this.neutralRequired){if(!next.size)this.neutralRequired=false;this.held.clear();return;}
    for(const key of next)if(!this.held.has(key))this.keys.down(key,`Gamepad:${key}`);
    this.held=next;
  }
}
