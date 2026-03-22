import {TxScope, commit, exec} from '../src/Resource/TxScope';

type TxData = {
  from: string;
  to: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS';
};

const mockDB = {
  clean: () => console.log('[CLEAN] DB连接已关闭'),
  commit: (data: TxData) =>
    console.log(`[COMMIT] 成功转账 ${data.amount} 到 ${data.to}`),
  rollback: () => console.log(`[ROLLBACK] 事务中断，转账失败！`),
};

function transfer(from: string, to: string, amount: number) {
  try {
    using tx = TxScope.open(
      {from, to, amount, status: 'PENDING'},
      mockDB.clean,
      mockDB.commit as (data: TxData) => void,
      mockDB.rollback,
    );

    exec(tx, (data) => {
      if (data.from === 'ErrorUser') {
        throw new Error('余额不足！');
      }
      data.status = 'SUCCESS';
    });
    commit(tx);
  } catch (e) {
    if (e instanceof Error) {
      console.log(`外部捕获：${e.message} (TxScope 已自动回滚或提交)`);
    }
  }
}

transfer('UserA', 'UserB', 100);
transfer('ErrorUser', 'UserC', 50);
