import test from 'node:test'
import assert from 'node:assert/strict'
import { ALERT_DURATION_MS, createAlertQueue } from '../src/alertQueue.mjs'

function setup() {
  let clock=0, nextId=0, entries=[]
  const timers=new Map()
  const queue=createAlertQueue({
    schedule:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,at:clock+delay});return id},
    cancel:id=>timers.delete(id),onChange:value=>{entries=value},
  })
  function advance(ms) {
    clock+=ms
    for (const [id,timer] of [...timers]) if(timer.at<=clock){timers.delete(id);timer.callback()}
  }
  return {queue,advance,get entries(){return entries},timers}
}
test('success, warning and error alerts close after exactly seven seconds',()=>{
  assert.equal(ALERT_DURATION_MS,7000)
  for(const tone of ['success','warning','error']) {
    const app=setup();let dismissed=0
    app.queue.show({key:'a',message:'Сообщение',tone,onDismiss:()=>dismissed++})
    app.advance(6999);assert.equal(app.entries.length,1);assert.equal(dismissed,0)
    app.advance(1);assert.equal(app.entries.length,0);assert.equal(dismissed,1)
  }
})
test('new feedback from the same source restarts expiry without duplicate alerts',()=>{
  const app=setup()
  app.queue.show({key:'a',message:'Первое'})
  app.advance(6000);app.queue.show({key:'a',message:'Второе'})
  assert.equal(app.entries.length,1);assert.equal(app.entries[0].message,'Второе')
  app.advance(6999);assert.equal(app.entries.length,1)
  app.advance(1);assert.equal(app.entries.length,0)
})
test('manual close clears the timer and invokes dismissal only once',()=>{
  const app=setup();let dismissed=0
  app.queue.show({key:'a',message:'Готово',onDismiss:()=>dismissed++})
  app.queue.dismiss('a');assert.equal(app.timers.size,0)
  app.advance(7000);app.queue.dismiss('a');assert.equal(dismissed,1)
})
test('component disposal or an empty message removes its alert silently',()=>{
  const app=setup();let dismissed=0
  app.queue.show({key:'a',message:'Готово',onDismiss:()=>dismissed++})
  app.queue.show({key:'a',message:''});assert.equal(dismissed,0);assert.equal(app.timers.size,0)
  app.queue.show({key:'a',message:'Ошибка',onDismiss:()=>dismissed++})
  app.queue.dismiss('a',false);assert.equal(dismissed,0);assert.equal(app.entries.length,0)
})
test('simultaneous alerts keep independent timers and action links',()=>{
  const app=setup();app.queue.show({key:'a',message:'Создан тикет',to:'/tickets?ticket=42'})
  app.advance(3000);app.queue.show({key:'b',message:'Логотип обновлён'})
  assert.equal(app.entries[0].to,'/tickets?ticket=42')
  app.advance(4000);assert.deepEqual(app.entries.map(x=>x.key),['b'])
  app.advance(3000);assert.equal(app.entries.length,0)
})
test('a burst stays bounded and releases timers for evicted alerts',()=>{
  const app=setup();let dismissed=0
  for(let i=0;i<8;i++)app.queue.show({key:String(i),message:String(i),onDismiss:()=>dismissed++})
  assert.deepEqual(app.entries.map(x=>x.key),['4','5','6','7'])
  assert.equal(app.timers.size,4);assert.equal(dismissed,4)
  app.advance(7000);assert.equal(app.entries.length,0);assert.equal(dismissed,8)
})
