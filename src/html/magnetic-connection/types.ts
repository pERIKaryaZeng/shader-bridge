import { ClassicPreset, GetSchemes } from "rete";

export type Position = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };

export type Node = ClassicPreset.Node & { width: number; height: number };
export type Connection<
  A extends Node,
  B extends Node
> = ClassicPreset.Connection<A, B> & { isMagnetic?: boolean };

export type Schemes = GetSchemes<Node, Connection<Node, Node>>;
