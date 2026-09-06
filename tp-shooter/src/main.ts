import { Registry } from "./ecs";
import "./style.css";

const canvas = document.createElement("canvas")
const ctx = canvas.getContext("2d")
const app = document.getElementById("app")

canvas.width = innerWidth
canvas.height = innerHeight

if (!app) throw new Error("Div with ID app must exist")
app.append(canvas)


const registry = new Registry();
registry.createComponent("enemy")
registry.createComponent("health")
registry.createComponent("effect")
registry.createComponent("bullet")
registry.createComponent("pickUp")
registry.createComponent("render")
registry.createComponent("transform")
registry.createComponent("inventory")

