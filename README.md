# FK Lab

物理で蹴るフリーキック・ラボ。「ボールのどこを、どの向きに、どの強さで蹴ると、なぜそう曲がるのか」を 3D と力ベクトルで見える化します。

制作中です（マイルストーン 6: 逆算モードとプリセットまで完了）。仕様は [SPEC.md](SPEC.md)、制作の記録は [docs/LOG.md](docs/LOG.md) にあります。

- コードはすべて Claude Code（Fable 5.2）が書いています。
- 設計の参考: [cap-flight-sim](https://github.com/koshien2015/cap-flight-sim)（キャップ野球の飛翔シミュレータ）。コードは流用せず、新しく書いています。
- 空力係数はすべて仮定値で、実測で検証したものではありません。

## 動かし方

```sh
npm install
npm run dev    # 3D のラボ（/graphs.html に物理コアのグラフ）
npm test       # 物理のユニットテスト
npm run sim    # コンソールに数値を出す
```
