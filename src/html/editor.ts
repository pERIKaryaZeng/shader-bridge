import { createRoot } from "react-dom/client";
import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets
} from "rete-connection-plugin";
import { ReactPlugin, Presets, ReactArea2D } from "rete-react-plugin";
import {
  useMagneticConnection,
  MagneticConnection
} from "./magnetic-connection";

const socket = new ClassicPreset.Socket("socket");

class Node extends ClassicPreset.Node {
  width = 180;
  height = 260;

  constructor() {
    super("Node");

    this.addInput("a", new ClassicPreset.Input(socket, "A"));
    this.addInput("b", new ClassicPreset.Input(socket, "B"));
    this.addInput("c", new ClassicPreset.Input(socket, "C"));

    this.addOutput("a", new ClassicPreset.Output(socket, "A"));
    this.addOutput("b", new ClassicPreset.Output(socket, "B"));
    this.addOutput("c", new ClassicPreset.Output(socket, "C"));
  }
}

class Connection<
  A extends Node,
  B extends Node
> extends ClassicPreset.Connection<A, B> {
  isMagnetic = true;
}

type Schemes = GetSchemes<Node, Connection<Node, Node>>;
type AreaExtra = ReactArea2D<Schemes>;

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl()
  });

  render.addPreset(
    Presets.classic.setup({
      customize: {
        connection(data) {
          if (data.payload.isMagnetic) return MagneticConnection;
          return Presets.classic.Connection;
        }
      }
    })
  );

  connection.addPreset(ConnectionPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(render);

  AreaExtensions.simpleNodesOrder(area);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMagneticConnection(connection, {
    async createConnection(from, to) {
      if (from.side === to.side) return;

      const [source, target] = from.side === "output" ? [from, to] : [to, from];
      const sourceNode = editor.getNode(source.nodeId);
      const targetNode = editor.getNode(target.nodeId);

      if (!sourceNode || !targetNode) {
        console.error("Source or target node not found");
        return;
      }

      // 使用自定义 Connection 类
      await editor.addConnection(
        new Connection(
          sourceNode,
          source.key as never,
          targetNode,
          target.key as never
        )
      );
    },
    display(from, to) {
      return from.side !== to.side;
    },
    offset(socket, position) {
      const socketRadius = 10;
      return {
        x:
          position.x + (socket.side === "input" ? -socketRadius : socketRadius),
        y: position.y
      };
    }
  });

  const a = new Node();
  const b = new Node();

  await editor.addNode(a);
  await editor.addNode(b);

  await area.translate(a.id, { x: 0, y: 0 });
  await area.translate(b.id, { x: 400, y: 0 });

  setTimeout(() => {
    // wait until nodes rendered because they dont have predefined width and height
    AreaExtensions.zoomAt(area, editor.getNodes());
  }, 10);
  return {
    destroy: () => area.destroy()
  };
}
