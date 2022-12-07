# eslint-plugin-sort-keys-vue-fix

Fork of eslint rule that sorts keys in objects (https://eslint.org/docs/rules/sort-keys) with autofix enabled compatible with vue order-in-components

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-sort-keys-vue-fix`:

```sh
npm install eslint-plugin-sort-keys-vue-fix --save-dev
```

## Usage

Add `123` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "eslint-plugin-sort-keys-vue-fix"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "sort-keys-vue-fix/sort-keys-vue-fix": [
            "warn",
            "asc",
            {
                "caseSensitive": true,
                "ignoreChildrenOf": ["model"],
                "ignoreGrandchildrenOf": [
                    "computed",
                    "directives",
                    "inject",
                    "props",
                    "watch",
                ],
                "minKeys": 2,
                "natural": false
            }
        ]
    }
}
```

## Supported Rules

* Fill in provided rules here


