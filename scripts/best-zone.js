const k = require('kolmafia')
Object.assign(globalThis, k);

if (!Array.prototype.flat) {
	Object.defineProperty(Array.prototype, 'flat', {
		configurable: true,
		value: function flat () {
			var depth = isNaN(arguments[0]) ? 1 : Number(arguments[0]);

			return depth ? Array.prototype.reduce.call(this, function (acc, cur) {
				if (Array.isArray(cur)) {
					acc.push.apply(acc, flat.call(cur, depth - 1));
				} else {
					acc.push(cur);
				}

				return acc;
			}, []) : Array.prototype.slice.call(this);
		},
		writable: true
	});
}

const garboRegularValueCache = new Map();
const garboHistoricalValueCache = new Map();
function garboValue(item, useHistorical) {
  const cachedValue =
    garboRegularValueCache.get(item) == null ? 
    (useHistorical ? garboHistoricalValueCache.get(item) : undefined) :garboRegularValueCache.get(item);
  if (cachedValue === undefined) {
    const value = garboSaleValue(item, useHistorical);
    (useHistorical ? garboHistoricalValueCache : garboRegularValueCache).set(item, value);
    return value;
  }
  return cachedValue;
}

function garboSaleValue(item, useHistorical) {
  if (useHistorical) {
    if (historicalAge(item) <= 7.0 && historicalPrice(item) > 0) {
      const isMallMin = historicalPrice(item) === Math.max(100, 2 * autosellPrice(item));
      return isMallMin ? autosellPrice(item) : 0.9 * historicalPrice(item);
    }
  }
  return getSaleValue(item);
}

const valueMap = new Map();
const MALL_VALUE_MODIFIER = 0.9;
/**
 * Returns the average value--based on mallprice and autosell--of a collection of items
 * @param items items whose value you care about
 */
function getSaleValue(item) {
        if (valueMap.has(item))
            return valueMap.get(item) || 0;
        if (item.discardable) {
            valueMap.set(item, mallPrice(item) > Math.max(2 * autosellPrice(item), 100)
                ? MALL_VALUE_MODIFIER * mallPrice(item)
                : autosellPrice(item));
        }
        else {
            valueMap.set(item, mallPrice(item) > 100 ? MALL_VALUE_MODIFIER * mallPrice(item) : 0);
        }
        return valueMap.get(item) || 0;
}

function sum(addends, mappingFunction) {
    return addends.reduce((subtotal, element) => subtotal + mappingFunction(element), 0);
}

function averageAutumnatonValue(
  location
) {
  const badAttributes = ["LUCKY", "ULTRARARE", "BOSS"];
  const rates = appearanceRates(location);
  const monsters = Object.keys(getLocationMonsters(location))
    .map((m) => toMonster(m))
    .filter((m) => !badAttributes.some((s) => m.attributes.includes(s)) && rates[m.name] > 0);

  if (monsters.length === 0) {
    return null;
  } else {
    const maximumDrops = 5;
    const acuityCutoff = 20 - (3) * 5;
    const validDrops = monsters
      .map((m) => itemDropsArray(m))
      .flat()
      .map(({ rate, type, drop }) => ({
        value: !["c", "0"].includes(type) ? garboValue(drop, true) : 0,
        preAcuityExpectation: ["c", "0", ""].includes(type) ? (2 * rate) / 100 : 0,
        postAcuityExpectation:
          rate >= acuityCutoff && ["c", "0", ""].includes(type) ? (8 * rate) / 100 : 0,
      }));
    if (validDrops.length === 0) {
      return null;
    }
    const overallExpectedDropQuantity = sum(
      validDrops,
      ({ preAcuityExpectation, postAcuityExpectation }) =>
        preAcuityExpectation + postAcuityExpectation
    );
    const expectedCollectionValue = sum(
      validDrops,
      ({ value, preAcuityExpectation, postAcuityExpectation }) => {
        // This gives us the adjusted amount to fit within our total amount of available drop slots
        const adjustedDropAmount =
          (preAcuityExpectation + postAcuityExpectation) *
          Math.min(1, maximumDrops / overallExpectedDropQuantity);
        return adjustedDropAmount * value;
      }
    );
    return expectedCollectionValue;
  }
}

function pawDrops(
  location
) {
  const badAttributes = ["LUCKY", "ULTRARARE", "BOSS", "NOCOPY"];
  const rates = appearanceRates(location);
  const monsters = Object.keys(getLocationMonsters(location))
    .map((m) => toMonster(m))
    .filter((m) => !badAttributes.some((s) => m.attributes.includes(s)) && rates[m.name] > 0);

  if (monsters.length === 0) {
    return null;
  } else {
    const validDrops = monsters
      .map((m) => itemDropsArray(m))
      .flat()
	  .map(x => [x.drop, garboValue(x.drop, true)]);
    if (validDrops.length === 0) {
      return null;
    }
    return validDrops;
  }
}

function catDrops(location) {
  const rates = appearanceRates(location);
  const monsters = Object.keys(getLocationMonsters(location))
    .map((m) => toMonster(m))
    .filter((m) => rates[m.name] > 0);

  if (monsters.length === 0) {
    return null;
  } else {
    const validDrops = monsters
      .map((m) => itemDropsArray(m))
      .flat()
	  .filter(x => !["c", "p"].includes(type))
	  .map(x => [x.drop, garboValue(x.drop, true)]);
    if (validDrops.length === 0) {
      return null;
    }
    return validDrops;
  }
}

function ppMain() {
  const autumnMap = new Map(Location.all()
  .filter(x => x.parent != "Removed" && x.root != "Removed")
  .map(l => pawDrops(l))
  .filter(x => x != null)
  .flat()
  .sort((a, b) => a[1] - b[1]));
  for (let v of autumnMap) {
    print(`${v[1].toFixed(0)} - ${v[0].name}`)
  }
}

function autumnMain() {
  const autumnMap = new Map(Location.all().filter(x => x.parent != "Removed").map(l => [l, averageAutumnatonValue(l)]).filter(x => x[1] != null).sort((a, b) => a[1] - b[1]));
  for (let v of autumnMap) {
    print(`${v[1].toFixed(0)} - ${v[0]} - ${v[0].zone}`)
  }
}

function catMain() {
  const autumnMap = new Map(Location.all()
  .filter(x => x.parent != "Removed" && x.root != "Removed")
  .map(l => catDrops(l))
  .filter(x => x != null)
  .flat()
  .sort((a, b) => a[1] - b[1]));
  for (let v of autumnMap) {
    print(`${v[1].toFixed(0)} - ${v[0].name}`)
  }
}

function main(args) {
	[type, id] = args.split(" ");
	if (type == "autumnaton") {
		autumnMain();
	} else if (type == "monkeypaw") {
		ppMain()
	} else if (type == "cat") {
		catMain()
	} else {
		print("best-zone [autumnaton|monkeypaw|cat]");
	}
}

module.exports.main = main
