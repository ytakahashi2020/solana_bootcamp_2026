# Pyth Oracle Integration

Solana上でPythオラクルを使用して価格データを取得する簡易的なプログラムです。

## 機能

- `get_sol_price` - SOL/USDの価格を取得
- `get_usdc_price` - USDC/USDの価格を取得
- `get_price_by_feed_id` - 任意のFeed IDで価格を取得

## 依存関係

```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl = "0.32.1"
pyth-solana-receiver-sdk = "1.1.0"
```

## ビルド方法

### Edition 2024 エラーの回避

`pyth-solana-receiver-sdk` の依存関係で、`base64ct` や `constant_time_eq` の最新バージョンが Rust Edition 2024 を使用しています。Solana の platform-tools (Cargo 1.84.0) は Edition 2024 をサポートしていないため、以下のコマンドでバージョンを固定する必要があります。

```bash
# base64ct を 1.6.0 に固定
cargo update -p base64ct@1.8.2 --precise 1.6.0

# blake3 を下げると constant_time_eq も自動的に 0.3.1 に下がる
cargo update -p blake3 --precise 1.5.5

# ビルド
anchor build
```

### エラー例

```
error: failed to download `base64ct v1.8.2`
Caused by:
  feature `edition2024` is required
  The package requires the Cargo feature called `edition2024`,
  but that feature is not stabilized in this version of Cargo (1.84.0)
```

## テスト

テストには以下のnpmパッケージが必要です：

```bash
yarn add @pythnetwork/hermes-client @pythnetwork/pyth-solana-receiver
```

テストはdevnetまたはmainnetで実行してください（Pythの価格フィードはlocalhostでは利用できません）。

```bash
anchor test --provider.cluster devnet
```

## Price Feed IDs

- SOL/USD: `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`
- USDC/USD: `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a`

その他のPrice Feed IDは [Pyth Network](https://www.pyth.network/developers/price-feed-ids) で確認できます。
