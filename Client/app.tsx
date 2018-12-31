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
  socketTime:Average,
  requestSize:number
 }

class Scene extends React.Component<Props, State> {
  constructor(props:Props, context:any) {
    super(props, context)

    const socket = new WebSocket('wss://localhost:5001/ws')
    socket.binaryType = 'arraybuffer'
    this.state = {
      socket:socket,
      jsonEndpointTime:zeroAverage,
      binaryEndpointTime:zeroAverage,
      socketTime:zeroAverage,
      requestSize:10
    }

    socket.addEventListener('message', event => {
      this.callbacks.forEach(c => c(event.data));
      this.callbacks = []
    });
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

  loadNumbersFromSocket() : Promise<number[]> {
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
        console.log(v, e.currentTarget.value)
        this.setState(s => ({...s, requestSize:v}))
      } } />

      <button onClick={_ => this.testJsonEndpoint(trials)}>Load numbers from JSON endpoint</button>
      <button onClick={_ => this.testBinaryEndpoint(trials)}>Load numbers from binary endpoint</button>
      <button onClick={_ => this.testSocket(trials)}>Load numbers from socket</button>

      <p>JSON endpoint time: {average(this.state.jsonEndpointTime)}</p>
      <p>Binary endpoint time: {average(this.state.binaryEndpointTime)}</p>
      <p>Socket time: {average(this.state.socketTime)}</p>
    </div>
  }

  testJsonEndpoint(trials:number) {
    const t0 = Date.now()
    if (!this.state.socket) return
    this.state.socket.send("request_numbers")
      this.loadNumbersFromJSONEndpoint().then(res => {
      const t1 = Date.now()
      console.log("Result:", res)
      this.setState(s => ({...s, jsonEndpointTime:addItem(t1-t0, s.jsonEndpointTime)}), () =>
        trials > 0 ? this.testJsonEndpoint(trials - 1) : undefined)
    })
  }

  testBinaryEndpoint(trials:number) {
    const t0 = Date.now()
    if (!this.state.socket) return
    this.state.socket.send("request_numbers")
      this.loadNumbersFromBinaryEndpoint().then(res => {
      const t1 = Date.now()
      console.log("Result:", res)
      this.setState(s => ({...s, binaryEndpointTime:addItem(t1-t0, s.binaryEndpointTime)}), () =>
        trials > 0 ? this.testBinaryEndpoint(trials - 1) : undefined)
    })
  }

  testSocket(trials:number) {
    const t0 = Date.now()
    if (!this.state.socket) return
    var dv = new DataView(new ArrayBuffer(4))
    dv.setInt32(0, this.state.requestSize, true)
    this.state.socket.send(dv)
      this.loadNumbersFromSocket().then(res => {
      const t1 = Date.now()
      console.log("Result:", res)
      this.setState(s => ({...s, socketTime:addItem(t1-t0, s.socketTime)}), () =>
        trials > 0 ? this.testSocket(trials - 1) : undefined)
    })
  }
}

export const main = () =>
  ReactDOM.render(
    <Scene />,
    document.getElementById("react-content")
  )
