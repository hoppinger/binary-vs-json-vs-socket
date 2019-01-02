import 'babel-polyfill'
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { rejects } from 'assert';
import { decode } from 'punycode';

interface Average { sum:number, numItems:number }
const zeroAverage = { sum:0, numItems:0 }
const addItem = (x:number, a:Average) : Average => ({ sum:a.sum + x, numItems:a.numItems+1 })
const average = (a:Average) : number => a.sum / a.numItems

interface Props {}
interface State { socket?:WebSocket,
  jsonEndpointTime:Average,
  binaryEndpointTime:Average,
  binarySocketTime:Average,
  jsonSocketTime:Average,
  requestSize:number
 }

class Scene extends React.Component<Props, State> {
  constructor(props:Props, context:any) {
    super(props, context)

    this.state = {
      socket:this.initSocket(),
      jsonEndpointTime:zeroAverage,
      binaryEndpointTime:zeroAverage,
      binarySocketTime:zeroAverage,
      jsonSocketTime:zeroAverage,
      requestSize:10
    }
  }

  initSocket() {
    const url = `wss${window.location.origin.replace(/^https/, "")}/ws`
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    socket.addEventListener('message', event => {
      this.callbacks.forEach(c => c(event.data));
      this.callbacks = []
    });
    return socket
  }

  callbacks : Array<(data:any) => void> = []

  async loadNumbersFromJSONEndpoint() : Promise<number[]> {
    let headers = new Headers()
    headers.append('content-type', 'application/json')

    let res = await fetch(`/data/json?requestSize=${this.state.requestSize}`, { method: 'get', credentials: 'include', headers: headers })
    if (!res.ok) throw Error(res.statusText)
    let data = await res.json()
    return data as number[]
  }

  loadNumbersFromJSONSocket() : Promise<number[]> {
    return new Promise((res,rej) => {
      this.callbacks.push((data:ArrayBuffer) => {
        let s = ""
        new Uint8Array(data).forEach(x => s += String.fromCharCode(x))
        res(JSON.parse(s))
      })
    })
  }

  decodeStream(data:ArrayBuffer) : number[] {
    var dv = new DataView(data)
    const result = Array<number>()
    let offset = 0
    let numCharacters = dv.getInt32(offset, true)
    offset += 4
    for (let i = 0; i < numCharacters; i++) {
      result.push(dv.getUint16(offset, true))
      offset += 2
    }
    return result
  }

  async loadNumbersFromBinaryEndpoint() : Promise<number[]> {
    let headers = new Headers()
    headers.append('content-type', 'application/json')

    let res = await fetch(`/data/numbers?requestSize=${this.state.requestSize}`, { method: 'get', credentials: 'include', headers: headers })
    if (!res.ok) throw Error(res.statusText)
    let data = await res.arrayBuffer()
    return this.decodeStream(data)
  }

  loadNumbersFromBinarySocket() : Promise<number[]> {
    return new Promise((res,rej) => {
      this.callbacks.push((data:ArrayBuffer) => {

        res(this.decodeStream(data))
      })
    })
  }

  render() {
    const trials = 10
    return <div>
      <input type="number" value={this.state.requestSize.toString()} onChange={e => {
        const v = parseInt(e.currentTarget.value)
        this.setState(s => ({...s, requestSize:v}))
      } } />

      <button onClick={_ => this.testJsonEndpoint(trials)}>Load numbers from JSON endpoint</button>
      <button onClick={_ => this.testBinaryEndpoint(trials)}>Load numbers from binary endpoint</button>
      <button onClick={_ => this.testBinarySocket(trials)}>Load numbers from binary socket</button>
      <button onClick={_ => this.testJSONSocket(trials)}>Load numbers from JSON socket</button>
      <button onClick={_ => this.setState(s => ({...s,
        jsonEndpointTime:zeroAverage,
        binaryEndpointTime:zeroAverage,
        binarySocketTime:zeroAverage,
        jsonSocketTime:zeroAverage,
        requestSize:10}))}>Clear</button>

      <p>JSON endpoint time: {average(this.state.jsonEndpointTime)}</p>
      <p>Binary endpoint time: {average(this.state.binaryEndpointTime)}</p>
      <p>JSON socket time: {average(this.state.jsonSocketTime)}</p>
      <p>Binary socket time: {average(this.state.binarySocketTime)}</p>
    </div>
  }

  testJsonEndpoint(trials:number) {
    const t0 = Date.now()
    this.loadNumbersFromJSONEndpoint().then(res => {
      const t1 = Date.now()
      // console.log("Result:", res)
      this.setState(s => ({...s, jsonEndpointTime:addItem(t1-t0, s.jsonEndpointTime)}), () =>
        trials > 0 ? this.testJsonEndpoint(trials - 1) : undefined)
    })
  }

  testBinaryEndpoint(trials:number) {
    const t0 = Date.now()
    this.loadNumbersFromBinaryEndpoint().then(res => {
      const t1 = Date.now()
      // console.log("Result:", res)
      this.setState(s => ({...s, binaryEndpointTime:addItem(t1-t0, s.binaryEndpointTime)}), () =>
        trials > 0 ? this.testBinaryEndpoint(trials - 1) : undefined)
    })
  }

  testBinarySocket(trials:number) {
    if (!this.state.socket) return
    const t0 = Date.now()
    let f = () => {
      if (!this.state.socket) return
      var dv = new DataView(new ArrayBuffer(8))
      dv.setInt32(0, 0, true)
      dv.setInt32(4, this.state.requestSize, true)
      this.state.socket.send(dv)
      this.loadNumbersFromBinarySocket().then(res => {
        const t1 = Date.now()
        // console.log("Result:", res)
        this.setState(s => ({...s, binarySocketTime:addItem(t1-t0, s.binarySocketTime)}), () =>
        trials > 0 ? this.testBinarySocket(trials - 1) : undefined)
      })
    }
    if (this.state.socket.readyState != 1) {
      console.log("Reopening socket.")
      const f0 = f
      f = () => this.setState(s => ({...s, socket:this.initSocket()}), () => f0())
    }

    f()
  }

  testJSONSocket(trials:number) {
    if (!this.state.socket) return
    const t0 = Date.now()
    let f = () => {
      if (!this.state.socket) return
      var dv = new DataView(new ArrayBuffer(8))
      dv.setInt32(0, 1, true)
      dv.setInt32(4, this.state.requestSize, true)
      this.state.socket.send(dv)
      this.loadNumbersFromJSONSocket().then(res => {
        const t1 = Date.now()
        //console.log("Result:", res)
        this.setState(s => ({...s, jsonSocketTime:addItem(t1-t0, s.jsonSocketTime)}), () =>
        trials > 0 ? this.testJSONSocket(trials - 1) : undefined)
      })
    }
    if (this.state.socket.readyState != 1) {
      console.log("Reopening socket.")
      const f0 = f
      f = () => this.setState(s => ({...s, socket:this.initSocket()}), () => f0())
    }

    f()
  }
}

export const main = () =>
  ReactDOM.render(
    <Scene />,
    document.getElementById("react-content")
  )
