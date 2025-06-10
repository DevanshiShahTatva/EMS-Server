export function populateSeatLayoutStages(): any[] {
  return [
    {
      $unwind: {
        path: "$seatLayout",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "tickettypes",
        localField: "seatLayout.ticketType",
        foreignField: "_id",
        as: "seatLayout.ticketType",
      },
    },
    {
      $unwind: {
        path: "$seatLayout.ticketType",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$_id",
        doc: { $first: "$$ROOT" },
        seatLayout: { $push: "$seatLayout" },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ["$doc", { seatLayout: "$seatLayout" }],
        },
      },
    },
  ];
}
