-- Add the CV product groups supplied in the Ezron net price sheet.
-- Existing catalog rows and manually adjusted prices are preserved; only
-- missing materials and size/component/thickness variants are inserted.

CREATE TEMP TABLE "_cvCatalog" AS
SELECT *
FROM jsonb_to_recordset($catalog$
[
  {
    "key": "cv_rockwool_isogenepak",
    "name": "Steenwolschalen / Isogenepak SE (wit)",
    "class": "insulation",
    "category": "cv",
    "supplier": "Ezron Isolatie BV",
    "pipeMaterial": "steel",
    "finish": "white_pvc",
    "sizeUnit": "pipe_od_mm",
    "priceSource": "Prijslijst Ezron 2025",
    "priceValidFrom": "2025-01-01",
    "priceNote": "Nettoprijzen excl. btw",
    "variants": [
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 25.67,
        "costPrice": null,
        "ordinal": 0
      },
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 26.77,
        "costPrice": null,
        "ordinal": 1
      },
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 29.76,
        "costPrice": null,
        "ordinal": 2
      },
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 41.68,
        "costPrice": null,
        "ordinal": 3
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 29.16,
        "costPrice": null,
        "ordinal": 4
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 30.13,
        "costPrice": null,
        "ordinal": 5
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 33.48,
        "costPrice": null,
        "ordinal": 6
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 46.81,
        "costPrice": null,
        "ordinal": 7
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 30.5,
        "costPrice": null,
        "ordinal": 8
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 31.27,
        "costPrice": null,
        "ordinal": 9
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 34.64,
        "costPrice": null,
        "ordinal": 10
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 48.49,
        "costPrice": null,
        "ordinal": 11
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 32.09,
        "costPrice": null,
        "ordinal": 12
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 34.6,
        "costPrice": null,
        "ordinal": 13
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 35.88,
        "costPrice": null,
        "ordinal": 14
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 50.17,
        "costPrice": null,
        "ordinal": 15
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 34.38,
        "costPrice": null,
        "ordinal": 16
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 37.44,
        "costPrice": null,
        "ordinal": 17
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 38.52,
        "costPrice": null,
        "ordinal": 18
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 53.95,
        "costPrice": null,
        "ordinal": 19
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 36.61,
        "costPrice": null,
        "ordinal": 20
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 39.13,
        "costPrice": null,
        "ordinal": 21
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 40.87,
        "costPrice": null,
        "ordinal": 22
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 57.22,
        "costPrice": null,
        "ordinal": 23
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 40.21,
        "costPrice": null,
        "ordinal": 24
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 43.11,
        "costPrice": null,
        "ordinal": 25
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 54.7,
        "costPrice": null,
        "ordinal": 26
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 61.83,
        "costPrice": null,
        "ordinal": 27
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 50.65,
        "costPrice": null,
        "ordinal": 28
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 54.51,
        "costPrice": null,
        "ordinal": 29
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 59.78,
        "costPrice": null,
        "ordinal": 30
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 66.13,
        "costPrice": null,
        "ordinal": 31
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 52.11,
        "costPrice": null,
        "ordinal": 32
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 55.1,
        "costPrice": null,
        "ordinal": 33
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 64.62,
        "costPrice": null,
        "ordinal": 34
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 69.47,
        "costPrice": null,
        "ordinal": 35
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 59.47,
        "costPrice": null,
        "ordinal": 36
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 61.96,
        "costPrice": null,
        "ordinal": 37
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 71.04,
        "costPrice": null,
        "ordinal": 38
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 78.42,
        "costPrice": null,
        "ordinal": 39
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 61.76,
        "costPrice": null,
        "ordinal": 40
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 64.36,
        "costPrice": null,
        "ordinal": 41
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 80.71,
        "costPrice": null,
        "ordinal": 42
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 88.51,
        "costPrice": null,
        "ordinal": 43
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 82.39,
        "costPrice": null,
        "ordinal": 44
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 85.05,
        "costPrice": null,
        "ordinal": 45
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 92.17,
        "costPrice": null,
        "ordinal": 46
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 101,
        "costPrice": null,
        "ordinal": 47
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 95.91,
        "costPrice": null,
        "ordinal": 48
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 101.34,
        "costPrice": null,
        "ordinal": 49
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 106.5,
        "costPrice": null,
        "ordinal": 50
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 114.14,
        "costPrice": null,
        "ordinal": 51
      },
      {
        "size": "17",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 13.13,
        "costPrice": null,
        "ordinal": 52
      },
      {
        "size": "17",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 14.07,
        "costPrice": null,
        "ordinal": 53
      },
      {
        "size": "17",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 17.18,
        "costPrice": null,
        "ordinal": 54
      },
      {
        "size": "17",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 24,
        "costPrice": null,
        "ordinal": 55
      },
      {
        "size": "21",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 14.79,
        "costPrice": null,
        "ordinal": 56
      },
      {
        "size": "21",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 16.53,
        "costPrice": null,
        "ordinal": 57
      },
      {
        "size": "21",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 19.18,
        "costPrice": null,
        "ordinal": 58
      },
      {
        "size": "21",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 26.84,
        "costPrice": null,
        "ordinal": 59
      },
      {
        "size": "27",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 15.56,
        "costPrice": null,
        "ordinal": 60
      },
      {
        "size": "27",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 16.95,
        "costPrice": null,
        "ordinal": 61
      },
      {
        "size": "27",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 20.24,
        "costPrice": null,
        "ordinal": 62
      },
      {
        "size": "27",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 28.29,
        "costPrice": null,
        "ordinal": 63
      },
      {
        "size": "33",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 16.74,
        "costPrice": null,
        "ordinal": 64
      },
      {
        "size": "33",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 17.33,
        "costPrice": null,
        "ordinal": 65
      },
      {
        "size": "33",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 21.71,
        "costPrice": null,
        "ordinal": 66
      },
      {
        "size": "33",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 30.41,
        "costPrice": null,
        "ordinal": 67
      },
      {
        "size": "42",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 18.76,
        "costPrice": null,
        "ordinal": 68
      },
      {
        "size": "42",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 19.49,
        "costPrice": null,
        "ordinal": 69
      },
      {
        "size": "42",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 23.33,
        "costPrice": null,
        "ordinal": 70
      },
      {
        "size": "42",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 32.69,
        "costPrice": null,
        "ordinal": 71
      },
      {
        "size": "48",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 20.78,
        "costPrice": null,
        "ordinal": 72
      },
      {
        "size": "48",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 23.54,
        "costPrice": null,
        "ordinal": 73
      },
      {
        "size": "48",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 26.17,
        "costPrice": null,
        "ordinal": 74
      },
      {
        "size": "48",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 36.69,
        "costPrice": null,
        "ordinal": 75
      },
      {
        "size": "60",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 22.21,
        "costPrice": null,
        "ordinal": 76
      },
      {
        "size": "60",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 24.41,
        "costPrice": null,
        "ordinal": 77
      },
      {
        "size": "60",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 30.23,
        "costPrice": null,
        "ordinal": 78
      },
      {
        "size": "60",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 42.29,
        "costPrice": null,
        "ordinal": 79
      },
      {
        "size": "76",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 24.79,
        "costPrice": null,
        "ordinal": 80
      },
      {
        "size": "76",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 27.5,
        "costPrice": null,
        "ordinal": 81
      },
      {
        "size": "76",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 36.37,
        "costPrice": null,
        "ordinal": 82
      },
      {
        "size": "76",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 50.93,
        "costPrice": null,
        "ordinal": 83
      },
      {
        "size": "89",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 27.31,
        "costPrice": null,
        "ordinal": 84
      },
      {
        "size": "89",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 30.13,
        "costPrice": null,
        "ordinal": 85
      },
      {
        "size": "89",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 40.26,
        "costPrice": null,
        "ordinal": 86
      },
      {
        "size": "89",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 56.41,
        "costPrice": null,
        "ordinal": 87
      },
      {
        "size": "114",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 39.33,
        "costPrice": null,
        "ordinal": 88
      },
      {
        "size": "114",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 42.26,
        "costPrice": null,
        "ordinal": 89
      },
      {
        "size": "114",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 47.97,
        "costPrice": null,
        "ordinal": 90
      },
      {
        "size": "114",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 67.16,
        "costPrice": null,
        "ordinal": 91
      },
      {
        "size": "140",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 46.32,
        "costPrice": null,
        "ordinal": 92
      },
      {
        "size": "140",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 49.9,
        "costPrice": null,
        "ordinal": 93
      },
      {
        "size": "140",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 56.12,
        "costPrice": null,
        "ordinal": 94
      },
      {
        "size": "140",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 78.56,
        "costPrice": null,
        "ordinal": 95
      },
      {
        "size": "168",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 64.21,
        "costPrice": null,
        "ordinal": 96
      },
      {
        "size": "168",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 71.7,
        "costPrice": null,
        "ordinal": 97
      },
      {
        "size": "168",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 80.66,
        "costPrice": null,
        "ordinal": 98
      },
      {
        "size": "168",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 112.88,
        "costPrice": null,
        "ordinal": 99
      },
      {
        "size": "219",
        "component": "elbow",
        "thicknessMm": 25,
        "unit": "piece",
        "unitPrice": 83.05,
        "costPrice": null,
        "ordinal": 100
      },
      {
        "size": "219",
        "component": "elbow",
        "thicknessMm": 30,
        "unit": "piece",
        "unitPrice": 86.87,
        "costPrice": null,
        "ordinal": 101
      },
      {
        "size": "219",
        "component": "elbow",
        "thicknessMm": 40,
        "unit": "piece",
        "unitPrice": 108.26,
        "costPrice": null,
        "ordinal": 102
      },
      {
        "size": "219",
        "component": "elbow",
        "thicknessMm": 50,
        "unit": "piece",
        "unitPrice": 151.5,
        "costPrice": null,
        "ordinal": 103
      }
    ],
    "ordinal": 8
  },
  {
    "key": "cv_rockwool_alu_foil",
    "name": "Steenwolschalen versterkte alufolie",
    "class": "insulation",
    "category": "cv",
    "supplier": "Ezron Isolatie BV",
    "pipeMaterial": "steel",
    "finish": "reinforced_alu_foil",
    "sizeUnit": "pipe_od_mm",
    "priceSource": "Prijslijst Ezron 2025",
    "priceValidFrom": "2025-01-01",
    "priceNote": "Nettoprijzen excl. btw",
    "variants": [
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 12.2,
        "costPrice": null,
        "ordinal": 0
      },
      {
        "size": "17",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 14.09,
        "costPrice": null,
        "ordinal": 1
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 14.11,
        "costPrice": null,
        "ordinal": 2
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 16.17,
        "costPrice": null,
        "ordinal": 3
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 18.31,
        "costPrice": null,
        "ordinal": 4
      },
      {
        "size": "21",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 22.58,
        "costPrice": null,
        "ordinal": 5
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 14.72,
        "costPrice": null,
        "ordinal": 6
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 16.61,
        "costPrice": null,
        "ordinal": 7
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 21.15,
        "costPrice": null,
        "ordinal": 8
      },
      {
        "size": "27",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 25.68,
        "costPrice": null,
        "ordinal": 9
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 15.31,
        "costPrice": null,
        "ordinal": 10
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 17.42,
        "costPrice": null,
        "ordinal": 11
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 21.97,
        "costPrice": null,
        "ordinal": 12
      },
      {
        "size": "33",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 26.83,
        "costPrice": null,
        "ordinal": 13
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 16.7,
        "costPrice": null,
        "ordinal": 14
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 18.85,
        "costPrice": null,
        "ordinal": 15
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 23.45,
        "costPrice": null,
        "ordinal": 16
      },
      {
        "size": "42",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 28.22,
        "costPrice": null,
        "ordinal": 17
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 17.75,
        "costPrice": null,
        "ordinal": 18
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 20.01,
        "costPrice": null,
        "ordinal": 19
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 24.93,
        "costPrice": null,
        "ordinal": 20
      },
      {
        "size": "48",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 30.25,
        "costPrice": null,
        "ordinal": 21
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 19.53,
        "costPrice": null,
        "ordinal": 22
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 21.76,
        "costPrice": null,
        "ordinal": 23
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 27.01,
        "costPrice": null,
        "ordinal": 24
      },
      {
        "size": "60",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 32.22,
        "costPrice": null,
        "ordinal": 25
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 21.33,
        "costPrice": null,
        "ordinal": 26
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 24.1,
        "costPrice": null,
        "ordinal": 27
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 29.68,
        "costPrice": null,
        "ordinal": 28
      },
      {
        "size": "76",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 35.35,
        "costPrice": null,
        "ordinal": 29
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 23.33,
        "costPrice": null,
        "ordinal": 30
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 27.08,
        "costPrice": null,
        "ordinal": 31
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 33.35,
        "costPrice": null,
        "ordinal": 32
      },
      {
        "size": "89",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 39.53,
        "costPrice": null,
        "ordinal": 33
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 27.42,
        "costPrice": null,
        "ordinal": 34
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 30.44,
        "costPrice": null,
        "ordinal": 35
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 37.36,
        "costPrice": null,
        "ordinal": 36
      },
      {
        "size": "114",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 43.47,
        "costPrice": null,
        "ordinal": 37
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 32.86,
        "costPrice": null,
        "ordinal": 38
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 35.39,
        "costPrice": null,
        "ordinal": 39
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 41.12,
        "costPrice": null,
        "ordinal": 40
      },
      {
        "size": "140",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 48.54,
        "costPrice": null,
        "ordinal": 41
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 37.6,
        "costPrice": null,
        "ordinal": 42
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 38.93,
        "costPrice": null,
        "ordinal": 43
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 45.19,
        "costPrice": null,
        "ordinal": 44
      },
      {
        "size": "168",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 52.58,
        "costPrice": null,
        "ordinal": 45
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 25,
        "unit": "m",
        "unitPrice": 43.19,
        "costPrice": null,
        "ordinal": 46
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 30,
        "unit": "m",
        "unitPrice": 43.99,
        "costPrice": null,
        "ordinal": 47
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 40,
        "unit": "m",
        "unitPrice": 51.75,
        "costPrice": null,
        "ordinal": 48
      },
      {
        "size": "219",
        "component": "meter",
        "thicknessMm": 50,
        "unit": "m",
        "unitPrice": 60.15,
        "costPrice": null,
        "ordinal": 49
      }
    ],
    "ordinal": 9
  }
]
$catalog$::jsonb) AS source(
  "key" TEXT,
  "name" TEXT,
  "class" TEXT,
  "category" TEXT,
  "supplier" TEXT,
  "pipeMaterial" TEXT,
  "thicknessMm" INTEGER,
  "finish" TEXT,
  "sizeUnit" TEXT,
  "note" TEXT,
  "priceSource" TEXT,
  "priceValidFrom" TEXT,
  "priceValidTo" TEXT,
  "priceNote" TEXT,
  "ordinal" INTEGER,
  "variants" JSONB
);

INSERT INTO "Material" (
  "id", "orgId", "key", "name", "class", "category", "supplier",
  "pipeMaterial", "thicknessMm", "finish", "sizeUnit", "note",
  "priceSource", "priceValidFrom", "priceValidTo", "priceNote", "ordinal",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  organization."id",
  catalog."key",
  catalog."name",
  catalog."class"::"MaterialClass",
  catalog."category"::"MaterialSystemCategory",
  catalog."supplier",
  catalog."pipeMaterial",
  catalog."thicknessMm",
  catalog."finish",
  catalog."sizeUnit",
  catalog."note",
  catalog."priceSource",
  catalog."priceValidFrom"::timestamp(3),
  catalog."priceValidTo"::timestamp(3),
  catalog."priceNote",
  catalog."ordinal",
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
CROSS JOIN "_cvCatalog" AS catalog
ON CONFLICT ("orgId", "key") DO NOTHING;

INSERT INTO "MaterialVariant" (
  "id", "materialId", "size", "component", "thicknessMm", "unit",
  "unitPrice", "costPrice", "ordinal"
)
SELECT
  gen_random_uuid()::text,
  material."id",
  variant."size",
  variant."component"::"MaterialComponent",
  variant."thicknessMm",
  variant."unit",
  variant."unitPrice",
  variant."costPrice",
  variant."ordinal"
FROM "_cvCatalog" AS catalog
JOIN "Material" AS material ON material."key" = catalog."key"
CROSS JOIN LATERAL jsonb_to_recordset(catalog."variants") AS variant(
  "size" TEXT,
  "component" TEXT,
  "thicknessMm" INTEGER,
  "unit" TEXT,
  "unitPrice" DOUBLE PRECISION,
  "costPrice" DOUBLE PRECISION,
  "ordinal" INTEGER
)
ON CONFLICT ("materialId", "size", "component", "thicknessMm") DO NOTHING;

DROP TABLE "_cvCatalog";
