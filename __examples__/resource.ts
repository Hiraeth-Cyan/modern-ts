import {Resource, close, exec} from '../src/Resource/resource';

function createNode(name: string) {
  return Resource.open(name, (s: string) =>
    console.log(
      '[' +
        [
          new Date().getHours(),
          new Date().getMinutes(),
          new Date().getSeconds(),
        ]
          .map((n) => n.toString().padStart(2, '0'))
          .join(':') +
        '] ' +
        s +
        ' 已关闭'
    )
  );
}
// 创建根节点
const root = createNode('root');
exec(root, () => {
  using a = createNode('A');
  exec(a, () => {
    using _b1 = createNode('B1');
    using _b2 = createNode('B2');
  });
});

// 关闭整个树
close(root);
