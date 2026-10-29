import type { MemoryStorage } from './bench';
export interface StoryNode { title: string; text: string; options: { label: string; next: string }[] }
export interface StudentStory { id: string; title: string; theme: string; nodes: Record<string, StoryNode> }
const ending = (title: string, text: string): StoryNode => ({ title, text, options: [] });
export const STUDENT_STORIES: StudentStory[] = [
  { id:'seat',title:'The empty seat',theme:'Belonging · a new class',nodes:{
    start:{title:'Everyone seems to know someone.',text:'Lea reaches the classroom early. Bags mark most of the seats. She wonders if everyone else got a guide to making friends that she missed.',options:[{label:'Ask about the seat by the window',next:'ask'},{label:'Find a quiet place first',next:'quiet'}]},
    ask:{title:'A small opening.',text:'“Is anyone sitting here?” The student moves their bag. “Only my very disorganized notes.” They both laugh. What could Lea carry from this moment?',options:[{label:'A name to say hello to next time',next:'hello'},{label:'The courage it took to ask',next:'courage'}]},
    quiet:{title:'A place to arrive.',text:'Lea sits near the window. For now, learning the room is enough. A student nearby asks if this is the right class.',options:[{label:'Answer and introduce herself',next:'hello'},{label:'Answer, and keep the morning quiet',next:'courage'}]},
    hello:ending('A beginning can be small.','There is no instant best-friend montage. Just a name, a shared class, and the possibility of another hello.'),
    courage:ending('Belonging has no deadline.','Lea opens her notebook. Today she found a seat. There is room for the rest to unfold at her pace.'),
  }},
  {id:'result',title:'A number on a page',theme:'Academic pressure · disappointment',nodes:{
    start:{title:'The result is lower than expected.',text:'Noah studied on the bus after his shift. The score still hurts. A friend asks how the exam went. What might he choose to say?',options:[{label:'“I’m disappointed. Can we talk?”',next:'talk'},{label:'“I need a minute first.”',next:'pause'}]},
    talk:ending('A score is part of a day.','His friend listens without comparing marks. They don’t solve the semester over lunch. They share a sandwich and make room for the disappointment.'),
    pause:ending('The next step can wait a moment.','Noah folds the paper and walks outside. Later he might ask about feedback or study differently. Right now, he takes the long way past the trees.'),
  }},
  {id:'friend',title:'Between the messages',theme:'Friendship · uncertain silence',nodes:{
    start:{title:'The chat has been quiet.',text:'Sam has not heard from a friend in a week. The last message says “seen.” There could be many stories behind the silence. What might Sam do?',options:[{label:'Send a gentle check-in',next:'check'},{label:'Give the friendship a little space',next:'space'}]},
    check:ending('An invitation without a demand.','“Thinking of you. No pressure to reply.” Sam puts the phone away. Caring does not have to become waiting beside a screen.'),
    space:ending('Space can hold care too.','Sam makes dinner and saves a funny photo for another day. Not knowing is uncomfortable. There is still a whole evening to live.'),
  }},
  {id:'win',title:'The ordinary brave thing',theme:'Small victories · work and study',nodes:{
    start:{title:'Nothing extraordinary happened.',text:'Aya made it to class after an early shift, asked a question, and finally ate lunch sitting down. The day will not win an award. What would she like to notice?',options:[{label:'The question she almost didn’t ask',next:'question'},{label:'The lunch break she made room for',next:'lunch'}]},
    question:ending('A little less alone with a question.','Two classmates had been wondering the same thing. Aya smiles on the bus home. Some brave things happen at an ordinary volume.'),
    lunch:ending('A day can hold a little room for you.','For ten minutes, Aya watched people pass the window. The work was still there afterward. So was she.'),
  }},
];
export const LIBRARY_KEY='little-elsewhere-story-tree-v1';
export type StoryMemory=Record<string,string[]>;
export function storyNode(story:StudentStory,path:string[]):StoryNode {
  let node=story.nodes.start;
  for(const step of path){
    const option=node.options.find(option=>option.next===step);
    if(!option)break;
    node=story.nodes[option.next];
  }
  return node;
}
export function readStories(storage:MemoryStorage|null):StoryMemory {
  try {
    const raw:unknown=JSON.parse(storage?.getItem(LIBRARY_KEY)||'{}');
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
    const result:StoryMemory={};
    for(const story of STUDENT_STORIES){
      const path=(raw as Record<string,unknown>)[story.id];
      if(!Array.isArray(path)||path.length>8||path.some(step=>typeof step!=='string'))continue;
      let node=story.nodes.start;const valid:string[]=[];
      for(const step of path){const option=node.options.find(option=>option.next===step);if(!option)break;valid.push(step);node=story.nodes[step];}
      result[story.id]=valid;
    }
    return result;
  } catch{return {};}
}
export function saveStories(storage:MemoryStorage|null,memory:StoryMemory):boolean {
  try{if(!storage)return false;storage.setItem(LIBRARY_KEY,JSON.stringify(memory));return true;}catch{return false;}
}
