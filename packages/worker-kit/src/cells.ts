/**
 * One name, one cell. The same name always reaches the same Durable Object,
 * on whichever celld node currently owns it.
 */
export function cellByName<Cell extends Rpc.DurableObjectBranded | undefined>(
  namespace: DurableObjectNamespace<Cell>,
  name: string,
): DurableObjectStub<Cell> {
  return namespace.get(namespace.idFromName(name))
}
