# SevaSetu documentation

| Folder | What is in it |
|---|---|
| [`design/`](design/) | One design doc per feature, written and reviewed before building. Start at [design/README.md](design/README.md). |
| [`architecture/`](architecture/) | Diagrams: [today](architecture/current.md), [AWS target](architecture/aws-target.md), [data model](architecture/data-model.md), [request flows](architecture/request-flows.md). Images for slides are in `architecture/img/`. |
| [`adr/`](adr/) | Architecture decision records (PostgreSQL, rules in the database, AWS move, Canadian data region). |
| [`../infra/`](../infra/) | AWS CDK definition of the target setup (templates only, not deployed). |
| [`../load-tests/`](../load-tests/) | k6 load test for the 2-second search target. |
