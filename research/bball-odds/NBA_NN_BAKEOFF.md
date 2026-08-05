# Would a neural network be better for the NBA total?

Same games, same folds, same target, same features — only the estimator changes. `edge` is win% minus the best blind side inside the same rows; breakeven at −110 is 52.4%. `oos corr` is the correlation between the predicted residual and the actual one, out of sample, and it is the cleanest single number here.

## The bake-off

| estimator | oos corr | n @ k≥2 | win% | base% | edge | ROI | fit time |
|---|---|---|---|---|---|---|---|
| ridge | `+0.0672` | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 | 2s |
| ridge + symmetry | `+0.0605` | 1943 | 53.3 | 50.4 | **+2.9** | +1.8 | 4s |
| mlp | `+0.0470` | 1589 | 54.2 | 50.7 | **+3.5** | +3.4 | 29s |
| mlp + symmetry | `+0.0597` | 1620 | 53.9 | 50.2 | **+3.7** | +2.9 | 61s |

## Learning curve — is capacity the binding constraint?

The real question behind "would a network be better" is whether we are estimator-limited or data-limited. If the MLP is climbing steeply where ridge has flattened, a network is worth revisiting once we have more seasons. If both are flat, capacity is not what is holding this back and no architecture fixes it.

| min_train | ridge corr | mlp corr | ridge edge | mlp edge |
|---|---|---|---|---|
| 800 | `+0.0492` | `+0.0433` | +2.0 | +2.3 |
| 1500 | `+0.0672` | `+0.0470` | +3.3 | +3.5 |
| 2500 | `+0.0784` | `+0.0642` | +3.9 | +3.2 |

Ridge and MLP predictions correlate `+0.746` with each other. A high number means the network is reconstructing the same linear combination the hard way, which is the expected outcome when the true signal is a sum of weak terms; a low number with worse accuracy means it is fitting noise.

